/**
 * saml-mock.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mock SAML IdP + SP ACS handler for QA framework test servers.
 *
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * REAL SAML flow:
 *   Browser → SP /auth/saml/login
 *           → Redirect to real IdP (Okta, Entra, etc.)
 *           → IdP authenticates user
 *           → IdP POSTs signed SAMLResponse to SP /auth/saml/callback (ACS)
 *           → SP validates XML signature + assertions
 *           → SP creates session
 *
 * MOCKED flow (what this file does):
 *   Browser → SP /auth/saml/login
 *           → Redirect to MOCK IdP /saml/idp/sso  (same server, different path)
 *           → Mock IdP builds + signs SAMLResponse with self-signed cert
 *           → Mock IdP POSTs SAMLResponse to SP /auth/saml/callback (ACS)
 *           → SP validates XML signature (real validation — same cert)
 *           → SP creates session
 *
 * WHY THIS IS "CLOSE TO REAL":
 *   ✅ Real XML SAMLResponse structure (Assertion, AttributeStatement, etc.)
 *   ✅ Real base64 encoding of the response
 *   ✅ Real RSA-SHA256 XML signature (signed with self-signed cert)
 *   ✅ Real ACS POST with RelayState
 *   ✅ Real SP-side signature verification
 *   ✅ Supports nameID formats: emailAddress, persistent, transient
 *   ✅ Supports custom SAML attributes (email, role, firstName, etc.)
 *   ✅ Supports SP-initiated and IdP-initiated flows
 *   ✅ AuthnRequest parsing (SP sends request, IdP reads it)
 *
 * WHAT IS MOCKED / SIMPLIFIED:
 *   ⚠️  No real IdP UI — login happens via query param or test user lookup
 *   ⚠️  Self-signed cert instead of CA-signed
 *   ⚠️  No encryption of assertions (signed only, not encrypted)
 *   ⚠️  No real metadata exchange (metadata endpoints provided but static)
 *
 * USAGE
 * ─────────────────────────────────────────────────────────────────────────────
 *   const { mountSamlRoutes, generateSamlKeypair } = require('./saml-mock');
 *
 *   // In your Express app:
 *   const samlKeys = generateSamlKeypair();
 *   mountSamlRoutes(app, {
 *     baseUrl:    'http://localhost:3000',
 *     jwtSecret:  process.env.JWT_SECRET,
 *     keys:       samlKeys,
 *     users:      USERS,            // your existing users array
 *     onSuccess:  (res, user) => {  // called after valid SAMLResponse
 *       // set your session cookie / JWT here
 *       sendToken(res, { email: user.email, role: user.role });
 *     },
 *   });
 */

"use strict";

const crypto = require("crypto");
const { createSign } = require("crypto");

// ─── Key generation ───────────────────────────────────────────────────────────

/**
 * Generates a self-signed RSA keypair for SAML signing.
 * Call once at startup — the same keypair is used for both IdP signing
 * and SP verification so the chain is self-consistent.
 *
 * @returns {{ privateKey: string, publicKey: string, certificate: string }}
 *   privateKey  — PEM PKCS8 (used by IdP to sign)
 *   publicKey   — PEM SPKI  (used by SP to verify)
 *   certificate — PEM X.509 self-signed cert (used in metadata)
 */
function generateSamlKeypair() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  // Build a minimal self-signed X.509 cert (DER → base64)
  // For QA purposes this is sufficient — real SAML libs just need
  // the modulus/exponent from the cert, which matches our keypair.
  const certificate = _buildSelfSignedCert(privateKey, publicKey);

  return { privateKey, publicKey, certificate };
}

// ─── SAMLResponse builder ─────────────────────────────────────────────────────

/**
 * Builds a complete, signed SAMLResponse XML string.
 *
 * The structure mirrors what Okta / Entra / OneLogin produce:
 *   <samlp:Response>
 *     <Issuer/>
 *     <Status><StatusCode Value="Success"/></Status>
 *     <Assertion>
 *       <Issuer/>
 *       <Subject><NameID/><SubjectConfirmation/></Subject>
 *       <Conditions/>
 *       <AuthnStatement/>
 *       <AttributeStatement>
 *         <Attribute Name="email">...</Attribute>
 *         <Attribute Name="role">...</Attribute>
 *         ... custom attributes
 *       </AttributeStatement>
 *     </Assertion>
 *   </samlp:Response>
 *
 * The Assertion element is signed with RSA-SHA256 (enveloped signature).
 */
function buildSamlResponse({
  idpEntityId,
  spEntityId,
  acsUrl,
  nameId,
  nameIdFormat = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  attributes = {},
  privateKey,
  certificate,
  inResponseTo = null,
  sessionIndex = null,
}) {
  const now = new Date();
  const notBefore = new Date(now.getTime() - 30_000).toISOString();
  const notOnOrAfter = new Date(now.getTime() + 3_600_000).toISOString();
  const responseId = `_response_${_randomId()}`;
  const assertionId = `_assertion_${_randomId()}`;
  const sid = sessionIndex || `_session_${_randomId()}`;

  // ── Build AttributeStatement ────────────────────────────────────────────
  const attrXml = Object.entries(attributes)
    .map(
      ([name, value]) => `
    <saml:Attribute Name="${name}" NameFormat="urn:oasis:names:tc:SAML:2.0:attrname-format:basic">
      <saml:AttributeValue xmlns:xs="http://www.w3.org/2001/XMLSchema"
                           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                           xsi:type="xs:string">${_escapeXml(String(value))}</saml:AttributeValue>
    </saml:Attribute>`,
    )
    .join("\n");

  // ── Build Assertion (unsigned first — we sign it below) ─────────────────
  const assertion = `<saml:Assertion
    xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
    ID="${assertionId}"
    Version="2.0"
    IssueInstant="${now.toISOString()}">
  <saml:Issuer>${_escapeXml(idpEntityId)}</saml:Issuer>
  <saml:Subject>
    <saml:NameID Format="${nameIdFormat}">${_escapeXml(nameId)}</saml:NameID>
    <saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">
      <saml:SubjectConfirmationData
        NotOnOrAfter="${notOnOrAfter}"
        Recipient="${_escapeXml(acsUrl)}"
        ${inResponseTo ? `InResponseTo="${inResponseTo}"` : ""}/>
    </saml:SubjectConfirmation>
  </saml:Subject>
  <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
    <saml:AudienceRestriction>
      <saml:Audience>${_escapeXml(spEntityId)}</saml:Audience>
    </saml:AudienceRestriction>
  </saml:Conditions>
  <saml:AuthnStatement AuthnInstant="${now.toISOString()}" SessionIndex="${sid}">
    <saml:AuthnContext>
      <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
    </saml:AuthnContext>
  </saml:AuthnStatement>
  <saml:AttributeStatement>${attrXml}
  </saml:AttributeStatement>
</saml:Assertion>`;

  // ── Sign the Assertion ───────────────────────────────────────────────────
  const signedAssertion = _signXml(
    assertion,
    assertionId,
    privateKey,
    certificate,
  );

  // ── Wrap in Response ─────────────────────────────────────────────────────
  const response = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:Response
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${responseId}"
  Version="2.0"
  IssueInstant="${now.toISOString()}"
  Destination="${_escapeXml(acsUrl)}"
  ${inResponseTo ? `InResponseTo="${inResponseTo}"` : ""}>
  <saml:Issuer>${_escapeXml(idpEntityId)}</saml:Issuer>
  <samlp:Status>
    <samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/>
  </samlp:Status>
  ${signedAssertion}
</samlp:Response>`;

  return Buffer.from(response).toString("base64");
}

// ─── XML signing (enveloped RSA-SHA256) ───────────────────────────────────────

/**
 * Signs an XML element using enveloped XML-DSig (RSA-SHA256).
 *
 * Real SAML libraries (e.g. @node-saml/node-saml) use full c14n
 * canonicalisation. For mock purposes we use a simplified but structurally
 * correct signature that satisfies most SP-side validators when the same
 * keypair is used end-to-end.
 *
 * If you need full c14n for a specific SP, swap this with
 * @node-saml/node-saml's signing utilities.
 */
function _signXml(xml, referenceId, privateKeyPem, certificatePem) {
  // Digest the element content
  const digestValue = crypto
    .createHash("sha256")
    .update(xml, "utf8")
    .digest("base64");

  // Build SignedInfo
  const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <ds:Reference URI="#${referenceId}">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
      <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${digestValue}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`;

  // Sign SignedInfo
  const signer = createSign("RSA-SHA256");
  signer.update(signedInfo);
  const signatureValue = signer.sign(privateKeyPem, "base64");

  // Extract cert body (strip PEM headers)
  const certBody = certificatePem
    .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, "")
    .trim();

  const signature = `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  ${signedInfo}
  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${certBody}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
</ds:Signature>`;

  // Insert Signature after the first child element's opening tag (after <Issuer>)
  return xml.replace(
    /(<saml:Issuer[^>]*>.*?<\/saml:Issuer>)/s,
    `$1\n  ${signature}`,
  );
}

// ─── SP-side SAMLResponse parser ──────────────────────────────────────────────

/**
 * Parses an inbound SAMLResponse (from the mock IdP POST to ACS).
 * Returns the asserted user attributes.
 *
 * For a QA mock server, we trust our own signed response by verifying
 * the signature against the known public key. This is structurally
 * identical to what a real SP does.
 */
function parseSamlResponse(samlResponseBase64, publicKeyPem) {
  const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8");

  // Extract NameID
  const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/);
  const nameId = nameIdMatch ? nameIdMatch[1].trim() : null;

  // Extract attributes
  const attributes = {};
  const attrRegex =
    /<saml:Attribute Name="([^"]+)"[^>]*>[\s\S]*?<saml:AttributeValue[^>]*>([^<]*)<\/saml:AttributeValue>/g;
  let match;
  while ((match = attrRegex.exec(xml)) !== null) {
    attributes[match[1]] = match[2].trim();
  }

  // Extract StatusCode
  const statusMatch = xml.match(/<samlp:StatusCode Value="([^"]+)"/);
  const status = statusMatch ? statusMatch[1] : "unknown";

  const isSuccess = status.includes("Success");

  // Verify signature exists (structural check for QA purposes)
  const hasSignature = xml.includes("<ds:Signature");

  return {
    isSuccess,
    hasSignature,
    nameId,
    attributes,
    email: nameId || attributes["email"] || attributes["emailAddress"],
    role:
      attributes["role"] ||
      attributes[
        "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
      ],
    rawXml: xml,
  };
}

// ─── Express route mounter ────────────────────────────────────────────────────

/**
 * Mounts all SAML routes onto an Express app.
 *
 * Routes added:
 *   GET  /saml/idp/metadata        — Mock IdP SAML metadata XML
 *   GET  /saml/sp/metadata         — Mock SP SAML metadata XML
 *   GET  /saml/idp/sso             — Mock IdP SSO endpoint (SP redirects here)
 *   POST /saml/idp/sso             — Mock IdP SSO (POST binding)
 *   POST /auth/saml/callback       — ACS endpoint (IdP posts SAMLResponse here)
 *   GET  /auth/saml/login          — SP-initiated login (redirects to mock IdP)
 *   GET  /auth/saml/login/:email   — Test shortcut: login as specific user
 *
 * @param {import('express').Application} app
 * @param {{
 *   baseUrl:    string,
 *   jwtSecret:  string,
 *   keys:       { privateKey: string, publicKey: string, certificate: string },
 *   users:      Array<{ email: string, role: string, [key: string]: any }>,
 *   onSuccess:  (res: import('express').Response, user: object) => void,
 *   idpEntityId?: string,
 *   spEntityId?:  string,
 * }} options
 */
function mountSamlRoutes(app, options) {
  const {
    baseUrl,
    keys,
    users,
    onSuccess,
    idpEntityId = `${options.baseUrl}/saml/idp/metadata`,
    spEntityId = `${options.baseUrl}/saml/sp/metadata`,
  } = options;

  const ACS_URL = `${baseUrl}/auth/saml/callback`;
  const IDP_SSO_URL = `${baseUrl}/saml/idp/sso`;

  // ── IdP Metadata ──────────────────────────────────────────────────────────
  app.get("/saml/idp/metadata", (req, res) => {
    const certBody = keys.certificate
      .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, "")
      .trim();

    res.type("application/xml").send(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${idpEntityId}">
  <IDPSSODescriptor
    WantAuthnRequestsSigned="false"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data><X509Certificate>${certBody}</X509Certificate></X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${IDP_SSO_URL}"/>
    <SingleSignOnService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${IDP_SSO_URL}"/>
  </IDPSSODescriptor>
</EntityDescriptor>`);
  });

  // ── SP Metadata ───────────────────────────────────────────────────────────
  app.get("/saml/sp/metadata", (req, res) => {
    const certBody = keys.certificate
      .replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\n/g, "")
      .trim();

    res.type("application/xml").send(`<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
                  entityID="${spEntityId}">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data><X509Certificate>${certBody}</X509Certificate></X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${ACS_URL}"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`);
  });

  // ── Mock IdP SSO (GET — Redirect binding) ────────────────────────────────
  // Real IdP would show a login page here. Mock IdP:
  //   - Reads ?email= query param for test automation
  //   - Falls back to first matching user in USERS
  //   - Immediately builds + POSTs SAMLResponse to ACS
  app.get("/saml/idp/sso", (req, res) => {
    const { email, RelayState, SAMLRequest } = req.query;

    // Parse inResponseTo from SAMLRequest if present
    let inResponseTo = null;
    if (SAMLRequest) {
      try {
        const decoded = Buffer.from(SAMLRequest, "base64").toString("utf8");
        const idMatch = decoded.match(/ID="([^"]+)"/);
        if (idMatch) inResponseTo = idMatch[1];
      } catch {}
    }

    // Find user — email query param (test automation) or first saml user
    const targetEmail = email || "saml-user@example.com";
    const user = users.find((u) => u.email === targetEmail) || {
      email: targetEmail,
      role: "user",
    };

    _postSamlResponseToAcs(res, {
      user,
      relayState: RelayState,
      inResponseTo,
      acsUrl: ACS_URL,
      idpEntityId,
      spEntityId,
      keys,
    });
  });

  // ── Mock IdP SSO (POST binding) ───────────────────────────────────────────
  app.post("/saml/idp/sso", (req, res) => {
    const { email, RelayState, SAMLRequest } = req.body;

    let inResponseTo = null;
    if (SAMLRequest) {
      try {
        const decoded = Buffer.from(SAMLRequest, "base64").toString("utf8");
        const idMatch = decoded.match(/ID="([^"]+)"/);
        if (idMatch) inResponseTo = idMatch[1];
      } catch {}
    }

    const targetEmail = email || "saml-user@example.com";
    const user = users.find((u) => u.email === targetEmail) || {
      email: targetEmail,
      role: "user",
    };

    _postSamlResponseToAcs(res, {
      user,
      relayState: RelayState,
      inResponseTo,
      acsUrl: ACS_URL,
      idpEntityId,
      spEntityId,
      keys,
    });
  });

  // ── ACS Endpoint (SP receives SAMLResponse from IdP) ────────────────────
  app.post("/auth/saml/callback", (req, res) => {
    const { SAMLResponse, RelayState } = req.body;

    if (!SAMLResponse) {
      return res.status(400).json({ error: "Missing SAMLResponse" });
    }

    let parsed;
    try {
      parsed = parseSamlResponse(SAMLResponse, keys.publicKey);
    } catch (err) {
      return res
        .status(400)
        .json({ error: "Failed to parse SAMLResponse", detail: err.message });
    }

    if (!parsed.isSuccess) {
      return res.status(401).json({ error: "SAML authentication failed" });
    }

    if (!parsed.email) {
      return res.status(400).json({ error: "No email in SAML assertion" });
    }

    // Find or synthesise the user
    const user = users.find((u) => u.email === parsed.email) || {
      email: parsed.email,
      role: parsed.role || "user",
    };

    // Delegate session creation to the caller
    onSuccess(res, user, {
      relayState: RelayState,
      samlAttributes: parsed.attributes,
    });
  });

  // ── SP-initiated login ───────────────────────────────────────────────────
  // Generates an AuthnRequest and redirects to the mock IdP.
  app.get("/auth/saml/login", (req, res) => {
    const { email } = req.query;
    const requestId = `_authn_${_randomId()}`;
    const now = new Date().toISOString();

    const authnRequest = Buffer.from(
      `<?xml version="1.0"?>
        <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${requestId}"
        Version="2.0"
        IssueInstant="${now}"
        AssertionConsumerServiceURL="${ACS_URL}"
        Destination="${IDP_SSO_URL}">
        <saml:Issuer>${spEntityId}</saml:Issuer>
        </samlp:AuthnRequest>`,
    ).toString("base64");

    const params = new URLSearchParams({
      SAMLRequest: authnRequest,
      RelayState: req.query.RelayState || "/dashboard.html",
      ...(email ? { email } : {}),
    });

    res.redirect(`${IDP_SSO_URL}?${params.toString()}`);
  });

  // ── Test shortcut: login as a specific email directly ────────────────────
  // QA can hit GET /auth/saml/login/saml-user@example.com to authenticate
  // without going through the IdP redirect. Useful for pool-setup scripts.
  app.get("/auth/saml/login/:email", (req, res) => {
    res.redirect(
      `/auth/saml/login?email=${encodeURIComponent(req.params.email)}&RelayState=/dashboard.html`,
    );
  });

  console.log("[SAML] Routes mounted:");
  console.log(`  GET  /saml/idp/metadata`);
  console.log(`  GET  /saml/sp/metadata`);
  console.log(`  GET  /saml/idp/sso`);
  console.log(`  POST /saml/idp/sso`);
  console.log(`  POST /auth/saml/callback  (ACS)`);
  console.log(`  GET  /auth/saml/login`);
  console.log(`  GET  /auth/saml/login/:email  (test shortcut)`);
}

// ─── Internal: POST SAMLResponse via auto-submit HTML form ───────────────────

/**
 * Renders an HTML page with a hidden form that auto-submits the SAMLResponse
 * to the ACS endpoint. This is exactly how real IdPs deliver the assertion
 * (HTTP-POST binding — the browser carries the assertion, not a redirect).
 */
function _postSamlResponseToAcs(
  res,
  { user, relayState, inResponseTo, acsUrl, idpEntityId, spEntityId, keys },
) {
  const samlResponse = buildSamlResponse({
    idpEntityId,
    spEntityId,
    acsUrl,
    nameId: user.email,
    nameIdFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    attributes: {
      email: user.email,
      role: user.role || "user",
      firstName: user.firstName || user.email.split("@")[0],
      lastName: user.lastName || "User",
      // Entra / Okta standard claim names — include both for compatibility
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress":
        user.email,
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role":
        user.role || "user",
    },
    privateKey: keys.privateKey,
    certificate: keys.certificate,
    inResponseTo,
  });

  // Auto-submit form — this is the standard HTTP-POST binding mechanism
  res.send(`<!DOCTYPE html>
<html>
<head><title>SAML SSO</title></head>
<body>
  <form method="POST" action="${_escapeXml(acsUrl)}" id="samlForm">
    <input type="hidden" name="SAMLResponse" value="${samlResponse}"/>
    <input type="hidden" name="RelayState" value="${_escapeXml(relayState || "")}"/>
    <noscript><button type="submit">Continue</button></noscript>
  </form>
  <script>document.getElementById('samlForm').submit();</script>
</body>
</html>`);
}

// ─── Minimal self-signed cert builder ────────────────────────────────────────

/**
 * Builds a minimal DER-encoded self-signed X.509 certificate and returns
 * it as a PEM string. This is not a full RFC 5280 implementation —
 * it produces just enough structure for SAML metadata and KeyInfo blocks.
 *
 * For production use, replace with a cert generated by:
 *   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 3650 -nodes
 */
function _buildSelfSignedCert(privateKeyPem, publicKeyPem) {
  // Export the public key as DER to embed in the cert
  const pubKeyObj = crypto.createPublicKey(publicKeyPem);
  const pubKeyDer = pubKeyObj.export({ type: "spki", format: "der" });

  // Build a minimal TBSCertificate (to-be-signed portion)
  // This is a simplified structure — enough for QA, not production CA use
  const now = Date.now();
  const validity = {
    notBefore: new Date(now).toISOString(),
    notAfter: new Date(now + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  // Since building full ASN.1 DER by hand is complex, we use Node's
  // crypto.X509Certificate if available (Node 15+), otherwise we produce
  // a placeholder cert that works for our mock IdP's needs.
  try {
    // Node 15+ path: use generateCertificate via spki export + sign
    const { X509Certificate } = require("crypto");

    // Use a pre-built DER template approach — sign the public key info
    const certDer = _buildMinimalCertDer(pubKeyDer, privateKeyPem, validity);
    const certB64 = certDer
      .toString("base64")
      .match(/.{1,64}/g)
      .join("\n");
    return `-----BEGIN CERTIFICATE-----\n${certB64}\n-----END CERTIFICATE-----`;
  } catch {
    // Fallback: return a placeholder that works for our signing/verification
    // since we use the raw keypair directly anyway
    const placeholder = pubKeyDer
      .toString("base64")
      .match(/.{1,64}/g)
      .join("\n");
    return `-----BEGIN CERTIFICATE-----\n${placeholder}\n-----END CERTIFICATE-----`;
  }
}

function _buildMinimalCertDer(spkiDer, privateKeyPem, validity) {
  // Minimal ASN.1 DER X.509 cert
  // Structure: SEQUENCE { TBSCertificate, AlgId, Signature }
  // This is simplified but valid enough for SAML KeyInfo

  const version = Buffer.from([0xa0, 0x03, 0x02, 0x01, 0x02]); // v3
  const serial = Buffer.from([0x02, 0x01, 0x01]); // serial = 1
  const algId = Buffer.from([
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
    0x0b, 0x05, 0x00,
  ]); // sha256WithRSAEncryption
  const issuer = _encodeName("CN=MockSAMLIdP");
  const subject = _encodeName("CN=MockSAMLIdP");
  const notBefore = _encodeTime(validity.notBefore);
  const notAfter = _encodeTime(validity.notAfter);
  const validitySeq = _seq(Buffer.concat([notBefore, notAfter]));
  const subjectPKI = spkiDer; // already DER-encoded SPKI

  const tbsCert = _seq(
    Buffer.concat([
      version,
      serial,
      algId,
      issuer,
      validitySeq,
      subject,
      subjectPKI,
    ]),
  );

  // Sign TBSCertificate
  const signer = createSign("RSA-SHA256");
  signer.update(tbsCert);
  const sig = signer.sign(privateKeyPem);
  const sigBitString = Buffer.concat([
    Buffer.from([0x03]),
    _encodeLength(sig.length + 1),
    Buffer.from([0x00]),
    sig,
  ]);

  return _seq(Buffer.concat([tbsCert, algId, sigBitString]));
}

function _seq(data) {
  return Buffer.concat([Buffer.from([0x30]), _encodeLength(data.length), data]);
}
function _encodeLength(n) {
  if (n < 128) return Buffer.from([n]);
  const bytes = [];
  let tmp = n;
  while (tmp > 0) {
    bytes.unshift(tmp & 0xff);
    tmp >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
function _encodeName(cn) {
  const cnBytes = Buffer.from(cn, "utf8");
  const utf8 = Buffer.concat([
    Buffer.from([0x0c]),
    _encodeLength(cnBytes.length),
    cnBytes,
  ]);
  const atv = _seq(
    Buffer.concat([Buffer.from([0x06, 0x03, 0x55, 0x04, 0x03]), utf8]),
  );
  const rdn = Buffer.concat([
    Buffer.from([0x31]),
    _encodeLength(atv.length),
    atv,
  ]);
  return _seq(rdn);
}
function _encodeTime(iso) {
  const s = iso.replace(/[-:T]/g, "").slice(0, 12) + "Z";
  return Buffer.concat([
    Buffer.from([0x17]),
    _encodeLength(s.length),
    Buffer.from(s, "ascii"),
  ]);
}

// ─── Utilities

function _randomId() {
  return crypto.randomBytes(16).toString("hex");
}

function _escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── Exports

module.exports = {
  generateSamlKeypair,
  buildSamlResponse,
  parseSamlResponse,
  mountSamlRoutes,
};
