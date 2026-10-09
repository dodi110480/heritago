const MIN_LENGTH = 12;
const MAX_LENGTH = 64;

// Small common-password blocklist. Replace/augment with a full breached-password
// check (e.g. HaveIBeenPwned range API) before production rollout.
const COMMON_PASSWORDS = new Set([
    'password', 'passwort', 'passwort123', 'passwort1234', 'admin1234',
    '12345678', '123456789', '1234567890', 'qwertzuiop', 'qwertyuiop',
    'asdfghjkl', 'heritago123', 'familie123', 'stammbaum', 'letmein123',
    'welcome123', 'iloveyou1', 'monkey1234', 'abc1234567'
]);

export function validatePassword(
    password: string,
    context: { username?: string; email?: string } = {}
): string | null {
    if (!password) return 'Passwort ist erforderlich.';
    if (password.length < MIN_LENGTH) {
        return `Passwort muss mindestens ${MIN_LENGTH} Zeichen lang sein.`;
    }
    if (password.length > MAX_LENGTH) {
        return `Passwort darf höchstens ${MAX_LENGTH} Zeichen lang sein.`;
    }

    const lower = password.toLowerCase();
    if (context.username && lower.includes(context.username.toLowerCase())) {
        return 'Passwort darf nicht den Benutzernamen enthalten.';
    }
    if (context.email) {
        const local = context.email.split('@')[0].toLowerCase();
        if (local && lower.includes(local)) {
            return 'Passwort darf nicht die E-Mail-Adresse enthalten.';
        }
    }
    if (COMMON_PASSWORDS.has(lower)) {
        return 'Dieses Passwort ist zu unsicher (häufig verwendet). Bitte wähle ein anderes.';
    }

    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(re => re.test(password));
    if (classes.length < 3) {
        return 'Passwort muss mindestens 3 von 4 Zeichenklassen enthalten (Groß, Klein, Ziffer, Sonderzeichen).';
    }

    return null;
}
