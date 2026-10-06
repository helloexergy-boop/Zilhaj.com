/**
 * Authoritative Authentication and Role-Based Access Control (RBAC) Layer
 * - Strictly validates JWT and session tokens from headers only (no query strings).
 * - Rejects demo tokens unconditionally.
 * - Strict authenticated userId ownership enforcement.
 * - Role isolation: CUSTOMER, SUBADMIN/OPERATIONS, ADMIN.
 * - Subadmins explicitly blocked from financials, staff management, and root settings.
 */

const jwt = require('jsonwebtoken');
const { connectToDatabase } = require('../db');

function getJwtSecret() {
    return process.env.JWT_SECRET || 'zilhaj_jwt_super_secure_secret_key_2026_umrah';
}

function normalizeRole(role) {
    if (!role) return 'CUSTOMER';
    const r = String(role).toUpperCase().trim();
    if (r === 'ROLE_ADMIN' || r === 'ADMIN' || r === 'SUPERADMIN' || r === 'SUPER_ADMIN') return 'ADMIN';
    if (r === 'ROLE_SUBADMIN' || r === 'SUBADMIN' || r === 'OPERATIONS' || r === 'ROLE_OPERATIONS' || r === 'SENIOR SUB ADMIN' || r === 'SUB ADMIN') return 'SUBADMIN';
    return 'CUSTOMER';
}

/**
 * Sign an authoritative JWT token for an authenticated user.
 */
function generateAuthToken(user) {
    const payload = {
        id: String(user.id || user._id),
        email: user.email ? user.email.toLowerCase() : '',
        name: user.name || 'User',
        role: normalizeRole(user.role),
        permissions: Array.isArray(user.permissions) ? user.permissions : []
    };
    return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * Single authoritative authentication middleware.
 * Validates JWT or session tokens exclusively from request headers.
 */
function createAuthMiddleware({ loadUserByEmail, adminSessions } = {}) {
    return async function authenticateUser(req, res, next) {
        try {
            // Strictly check headers only - NO URL / query-string authentication
            const authHeader = req.headers['authorization'] || req.headers['x-auth-token'];
            let token = null;

            if (authHeader) {
                if (authHeader.startsWith('Bearer ')) {
                    token = authHeader.slice(7).trim();
                } else {
                    token = authHeader.trim();
                }
            }

            // Reject missing tokens with 401
            if (!token) {
                return res.status(401).json({
                    error: 'Unauthorized: Authentication token is required.',
                    code: 'UNAUTHORIZED'
                });
            }

            // Strictly reject demo tokens
            if (token.startsWith('demo-') || token.includes('demo-admin') || token.includes('demo-superadmin')) {
                return res.status(401).json({
                    error: 'Unauthorized: Demo tokens have been permanently disabled. Please log in with valid credentials.',
                    code: 'DEMO_TOKEN_PROHIBITED'
                });
            }

            let authenticatedUser = null;

            // 1. Try decoding and verifying as JWT
            try {
                const decoded = jwt.verify(token, getJwtSecret());
                if (decoded && (decoded.email || decoded.id)) {
                    const db = await connectToDatabase().catch(() => null);
                    if (db) {
                        authenticatedUser = await db.collection('users').findOne({
                            $or: [
                                ...(decoded.email ? [{ email: decoded.email.toLowerCase() }] : []),
                                ...(decoded.id ? [{ id: decoded.id }] : [])
                            ]
                        });
                    }

                    if (!authenticatedUser && decoded.email && loadUserByEmail) {
                        authenticatedUser = await loadUserByEmail(decoded.email);
                    }

                    // Fallback to verified JWT payload if DB record lookup was not returned
                    if (!authenticatedUser && decoded.email) {
                        authenticatedUser = {
                            id: decoded.id,
                            name: decoded.name,
                            email: decoded.email,
                            role: decoded.role,
                            permissions: decoded.permissions || [],
                            isStaffEnabled: true
                        };
                    }
                }
            } catch (jwtErr) {
                // Not a JWT, try session store lookup
            }

            // 2. Try session token lookup
            if (!authenticatedUser && adminSessions && typeof adminSessions.get === 'function') {
                const sessionEmail = adminSessions.get(token);
                if (sessionEmail) {
                    if (loadUserByEmail) {
                        authenticatedUser = await loadUserByEmail(sessionEmail);
                    }
                    if (!authenticatedUser) {
                        const db = await connectToDatabase().catch(() => null);
                        if (db) {
                            authenticatedUser = await db.collection('users').findOne({ email: sessionEmail.toLowerCase() });
                        }
                    }
                }
            }

            if (!authenticatedUser) {
                return res.status(401).json({
                    error: 'Unauthorized: Invalid or expired session token.',
                    code: 'INVALID_TOKEN'
                });
            }

            if (authenticatedUser.isStaffEnabled === false) {
                return res.status(403).json({
                    error: 'Forbidden: Account has been deactivated. Please contact platform administration.',
                    code: 'ACCOUNT_DEACTIVATED'
                });
            }

            // Attach sanitized authenticated user DTO to req.user (Never expose password hash)
            req.user = {
                id: String(authenticatedUser.id || authenticatedUser._id),
                name: authenticatedUser.name || 'User',
                email: (authenticatedUser.email || '').toLowerCase(),
                phone: authenticatedUser.phone || '',
                role: normalizeRole(authenticatedUser.role),
                rawRole: authenticatedUser.role || 'ROLE_USER',
                permissions: Array.isArray(authenticatedUser.permissions) ? authenticatedUser.permissions : [],
                isStaffEnabled: authenticatedUser.isStaffEnabled !== false
            };
            req.token = token;

            next();
        } catch (err) {
            console.error('[AUTH MIDDLEWARE] Verification error:', err.message);
            return res.status(500).json({ error: 'Internal Server Error during authentication.' });
        }
    };
}

/**
 * Middleware: Strictly enforce authenticated userId ownership to prevent identity spoofing.
 */
function validatePayloadUserId(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const payloadUserId = req.body.userId || req.body.customerId;

    if (payloadUserId) {
        const matchesId = String(payloadUserId) === String(req.user.id);
        const matchesEmail = String(payloadUserId).toLowerCase() === String(req.user.email).toLowerCase();

        const roleUpper = String(req.user.role || '').toUpperCase();
        const isCustomer = !roleUpper.includes('ADMIN') && !roleUpper.includes('STAFF');

        // Admin and Subadmin operations may act on behalf of customers if authorized,
        // but Customers can strictly only submit under their own identity.
        if (!matchesId && !matchesEmail && isCustomer) {
            return res.status(403).json({
                error: 'Forbidden: You cannot submit requests under another user identity.',
                code: 'ID_SPOOFING_DETECTED'
            });
        }
    }

    // Always enforce server-authoritative userId on the payload
    const roleUpper = String(req.user.role || '').toUpperCase();
    const isCustomer = !roleUpper.includes('ADMIN') && !roleUpper.includes('STAFF');
    if (isCustomer || !req.body.userId) {
        req.body.userId = String(req.user.id || req.user.email);
        req.body.userEmail = req.user.email;
        req.body.userName = req.user.name;
    }

    next();
}

/**
 * Middleware: Enforce user resource ownership on URL route params (:userId).
 * Customers can only access their own resources; staff can access for operations.
 */
function enforceUserOwnership(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' });
    }

    const requestedUserId = req.params.userId || req.query.userId;
    if (!requestedUserId) return next();

    const isOwner = String(requestedUserId) === String(req.user.id) ||
                    String(requestedUserId).toLowerCase() === String(req.user.email).toLowerCase();

    const isStaff = req.user.role === 'ADMIN' || req.user.role === 'SUBADMIN';

    if (!isOwner && !isStaff) {
        return res.status(403).json({
            error: 'Forbidden: You do not have permission to view or access resources of another user.',
            code: 'FORBIDDEN_OWNERSHIP_MISMATCH'
        });
    }

    next();
}

/**
 * Middleware generator: Enforce Role-Based Access Control (RBAC).
 */
function requireRole(allowedRoles = []) {
    const normalizedAllowed = allowedRoles.map(r => normalizeRole(r));

    return function (req, res, next) {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' });
        }

        const userRole = normalizeRole(req.user.role);

        if (!normalizedAllowed.includes(userRole)) {
            return res.status(403).json({
                error: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Your role is [${userRole}].`,
                code: 'FORBIDDEN_ROLE_MISMATCH'
            });
        }

        next();
    };
}

/**
 * Middleware: Restrict access strictly to Super Admin only.
 * Subadmins and Customers receive 403 Forbidden.
 */
function requireAdminOnly(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required.', code: 'UNAUTHORIZED' });
    }

    if (normalizeRole(req.user.role) !== 'ADMIN') {
        return res.status(403).json({
            error: 'Forbidden: This action requires Root / Super Administrator privileges. Sub-administrators and staff are prohibited from this resource.',
            code: 'ADMIN_PRIVILEGE_REQUIRED'
        });
    }

    next();
}

/**
 * Middleware: Block subadmins from accessing financials or revenue analytics.
 */
function blockSubadminFinancials(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    if (normalizeRole(req.user.role) === 'SUBADMIN') {
        return res.status(403).json({
            error: 'Forbidden: Sub-administrators are not permitted to access financial data, revenue figures, or bank details.',
            code: 'FINANCIAL_ACCESS_FORBIDDEN'
        });
    }

    next();
}

module.exports = {
    createAuthMiddleware,
    generateAuthToken,
    validatePayloadUserId,
    enforceUserOwnership,
    requireRole,
    requireAdminOnly,
    blockSubadminFinancials,
    normalizeRole
};
