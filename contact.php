<?php
/**
 * Casrose contact form endpoint.
 *
 * Receives the form from index.html and emails it on. Deliberately small: no
 * database, no library, nothing stored on disk except a short-lived rate-limit
 * marker.
 *
 * Security notes:
 *  - Every value that reaches a mail header has CR/LF stripped. Without that, a
 *    crafted "email" field could inject extra headers and turn this into an open
 *    relay for spam. This is the main thing to preserve if you edit the file.
 *  - The From: address is fixed to our own domain (never the visitor's) so the
 *    message passes SPF/DMARC. The visitor's address goes in Reply-To instead.
 */

declare(strict_types=1);

const MAIL_TO      = 'cas@casrose.co.uk';
const MAIL_FROM    = 'noreply@casrose.co.uk';
const MAX_PER_HOUR = 5;

/** Strip anything that could start a new mail header. */
function headerSafe(string $value): string
{
    return trim(str_replace(["\r", "\n", "%0a", "%0d", "\0"], '', $value));
}

/** Respond as JSON to the fetch() path, or as a plain page without JavaScript. */
function respond(bool $ok, string $error = ''): void
{
    $wantsJson = ($_POST['js'] ?? '') === '1';

    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code($ok ? 200 : 400);
        echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error]);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    http_response_code($ok ? 200 : 400);
    $heading = $ok ? 'Thank you' : 'That didn&rsquo;t send';
    $body    = $ok
        ? 'Your message is on its way. I&rsquo;ll reply by email.'
        : htmlspecialchars($error, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width,initial-scale=1">'
       . '<title>' . $heading . ' — Casrose</title>'
       . '<style>body{background:#14110e;color:#f4ede1;font-family:system-ui,sans-serif;'
       . 'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}'
       . 'a{color:#e8b56e}</style></head><body><div><h1>' . $heading . '</h1><p>' . $body
       . '</p><p><a href="/">Back to casrose.co.uk</a></p></div></body></html>';
    exit;
}

/** Crude per-IP throttle. Fails open: a broken temp dir must not block enquiries. */
function rateLimited(): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = sys_get_temp_dir() . '/casrose_cf_' . hash('sha256', $ip) . '.json';

    $now = time();
    $hits = [];
    if (is_readable($file)) {
        $decoded = json_decode((string) @file_get_contents($file), true);
        if (is_array($decoded)) {
            $hits = array_filter($decoded, static fn($t) => is_int($t) && $t > $now - 3600);
        }
    }

    if (count($hits) >= MAX_PER_HOUR) {
        return true;
    }

    $hits[] = $now;
    @file_put_contents($file, json_encode(array_values($hits)), LOCK_EX);
    return false;
}

// ---------------------------------------------------------------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Location: /', true, 303);
    exit;
}

// Bots fill hidden fields and submit instantly. Report success either way so we
// don't teach them what tripped the filter.
$honeypot = trim((string) ($_POST['company'] ?? ''));
$elapsed  = (int) ($_POST['elapsed'] ?? 99999);
if ($honeypot !== '' || $elapsed < 2000) {
    respond(true);
}

$name    = trim((string) ($_POST['name'] ?? ''));
$email   = trim((string) ($_POST['email'] ?? ''));
$message = trim((string) ($_POST['message'] ?? ''));

if ($name === '' || $email === '' || $message === '') {
    respond(false, 'Please fill in your name, email and message.');
}
if (mb_strlen($name) > 100 || mb_strlen($email) > 200 || mb_strlen($message) > 4000) {
    respond(false, 'That message is longer than this form accepts.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'That email address does not look right.');
}
if (rateLimited()) {
    respond(false, 'Too many messages from this connection. Please try again later, or email cas@casrose.co.uk.');
}

$safeName  = headerSafe($name);
$safeEmail = headerSafe($email);

$subject = 'casrose.co.uk enquiry from ' . $safeName;
$body = "New enquiry from the casrose.co.uk contact form.\n\n"
      . "Name:  {$safeName}\n"
      . "Email: {$safeEmail}\n"
      . 'Time:  ' . gmdate('Y-m-d H:i:s') . " UTC\n\n"
      . "Message:\n{$message}\n";

$headers = implode("\r\n", [
    'From: Casrose website <' . MAIL_FROM . '>',
    'Reply-To: ' . $safeName . ' <' . $safeEmail . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    'X-Mailer: casrose-contact',
]);

// The 5th argument is a fixed, non-user value on purpose.
$sent = @mail(MAIL_TO, headerSafe($subject), $body, $headers, '-f' . MAIL_FROM);

if (!$sent) {
    respond(false, 'The message could not be sent just now. Please email cas@casrose.co.uk directly.');
}

respond(true);
