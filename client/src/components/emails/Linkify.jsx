/**
 * Renders text with URLs and email addresses turned into links.
 *
 * Done by splitting the string and returning React nodes — never with
 * dangerouslySetInnerHTML, so nothing a sender wrote can become live markup.
 */
const TOKEN = /((?:https?:\/\/|www\.)[^\s<>()[\]]+|[\w.+-]+@[\w-]+\.[\w.-]+)/gi;

const TRAILING = /[.,;:!?)\]]+$/;

export default function Linkify({ text }) {
  const parts = String(text ?? '').split(TOKEN);

  return parts.map((part, i) => {
    if (!part) return null;

    const isUrl = /^(https?:\/\/|www\.)/i.test(part);
    const isEmail = !isUrl && /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(part);

    if (!isUrl && !isEmail) return part;

    // Punctuation that ends a sentence should not end up inside the href.
    const trailing = part.match(TRAILING)?.[0] || '';
    const target = trailing ? part.slice(0, -trailing.length) : part;

    const href = isEmail
      ? `mailto:${target}`
      : target.startsWith('http')
        ? target
        : `https://${target}`;

    return (
      <span key={i}>
        <a
          href={href}
          target={isEmail ? undefined : '_blank'}
          rel="noreferrer noopener"
          className="break-all font-medium text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
        >
          {target}
        </a>
        {trailing}
      </span>
    );
  });
}
