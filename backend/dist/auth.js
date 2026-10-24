import bcrypt from 'bcryptjs';
const SALT_ROUNDS = 10;
/**
 * Checks if a string is already a valid bcrypt hash.
 * Bcrypt hashes are 60 characters long and start with $2a$, $2b$, or $2y$.
 */
export function isBcryptHash(str) {
    if (!str)
        return false;
    return /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(str);
}
/**
 * Hashes a plaintext password using bcrypt.
 * If the input is already a bcrypt hash, it returns it unchanged.
 */
export async function hashPassword(password) {
    if (!password)
        return '';
    if (isBcryptHash(password)) {
        return password;
    }
    return bcrypt.hash(password, SALT_ROUNDS);
}
/**
 * Compares an entered plaintext password with a stored hash or plaintext password.
 * If stored value was plaintext, supports graceful fallback comparison.
 */
export async function comparePassword(entered, storedHashOrPlain) {
    if (!entered || !storedHashOrPlain)
        return false;
    if (isBcryptHash(storedHashOrPlain)) {
        return bcrypt.compare(entered, storedHashOrPlain);
    }
    // Fallback for legacy plaintext password
    return entered === storedHashOrPlain;
}
/**
 * Migration helper to ensure all passwords stored in Neon DB
 * (both in `branches.admin_password` and `users.password_hash`)
 * are encrypted as bcrypt hashes, eliminating any plain-text password exposure.
 */
export async function migratePlaintextPasswords(pool) {
    try {
        const client = await pool.connect();
        try {
            // 1. Migrate branches.admin_password
            const branchesRes = await client.query('SELECT id, code, admin_password FROM branches WHERE admin_password IS NOT NULL');
            for (const row of branchesRes.rows) {
                if (row.admin_password && !isBcryptHash(row.admin_password)) {
                    const hashed = await hashPassword(row.admin_password);
                    await client.query('UPDATE branches SET admin_password = $1 WHERE id = $2', [hashed, row.id]);
                    console.log(`[Auth Migration] Hashed plain password for branch: ${row.code} (${row.id})`);
                }
            }
            // 2. Migrate users.password_hash
            const usersRes = await client.query('SELECT id, employee_code, password_hash FROM users WHERE password_hash IS NOT NULL');
            for (const row of usersRes.rows) {
                if (row.password_hash && !isBcryptHash(row.password_hash)) {
                    const hashed = await hashPassword(row.password_hash);
                    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, row.id]);
                    console.log(`[Auth Migration] Hashed plain password for user: ${row.employee_code} (${row.id})`);
                }
            }
        }
        finally {
            client.release();
        }
    }
    catch (err) {
        console.warn('[Auth Migration] Notice during password migration:', err.message);
    }
}
