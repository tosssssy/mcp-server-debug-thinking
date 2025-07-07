# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of MCP Server Debug Thinking seriously. If you have discovered a security vulnerability in this project, please report it to us as described below.

### Reporting Process

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:
- your.email@example.com

Please include the following information in your report:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

### Response Timeline

- **Initial Response**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Status Update**: We will provide a status update within 5 business days
- **Resolution**: We aim to resolve critical issues within 30 days

### Disclosure Policy

- We will confirm the vulnerability and determine its impact
- We will release a fix as soon as possible, depending on the complexity of the issue
- We will credit you for the discovery (unless you prefer to remain anonymous)

## Security Best Practices for Users

When using MCP Server Debug Thinking:

1. **Keep Dependencies Updated**: Regularly update the package and its dependencies
2. **Secure Storage**: The `.debug-thinking-mcp/` directory contains debugging data. Ensure it's properly secured and not exposed publicly
3. **Environment Variables**: Never commit sensitive environment variables to version control
4. **Access Control**: Limit access to the MCP server to trusted clients only

## Security Features

The MCP Server Debug Thinking includes several security features:

- Data is stored locally in the project directory
- No external network requests are made
- No sensitive data is logged to console by default
- File paths are sanitized before storage

## Contact

For any security-related questions, please contact:
- Email: your.email@example.com
- PGP Key: [Link to PGP key if available]

Thank you for helping keep MCP Server Debug Thinking and its users safe!