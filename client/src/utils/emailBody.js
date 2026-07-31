/**
 * Turns a raw plain-text email body into the parts worth showing separately.
 *
 * Mail clients append the whole previous message to every reply, so rendering the
 * body verbatim buries two lines of new content under pages of history. Splitting
 * it lets the UI lead with what was actually written and tuck the rest away.
 */

/** Lines that mark the start of quoted history. */
const isQuoteStart = (line, lines, i) => {
  const l = line.trim();
  if (/^>/.test(l)) return true;
  if (/^on\b.*\bwrote:$/i.test(l)) return true;
  if (/^-{2,}\s*original message\s*-{2,}$/i.test(l)) return true;
  if (/^_{10,}$/.test(l)) return true;
  if (/^-{3,}\s*forwarded message\s*-{3,}$/i.test(l)) return true;
  // An Outlook-style quoted header block: "From:" followed by Sent/To/Subject.
  if (/^from:\s*\S+/i.test(l)) {
    return lines
      .slice(i + 1, i + 5)
      .some((next) => /^(sent|to|subject|date|cc):/i.test(next.trim()));
  }
  return false;
};

/** `-- ` on its own line is the conventional signature delimiter. */
const isSignatureDelimiter = (line) => /^--\s?$/.test(line);

export function splitEmailBody(raw = '') {
  const text = String(raw || '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  let quoteAt = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (isQuoteStart(lines[i], lines, i)) {
      quoteAt = i;
      break;
    }
  }

  const head = quoteAt === -1 ? lines : lines.slice(0, quoteAt);
  const quoted = quoteAt === -1 ? '' : lines.slice(quoteAt).join('\n').trim();

  let sigAt = -1;
  for (let i = 0; i < head.length; i += 1) {
    if (isSignatureDelimiter(head[i])) {
      sigAt = i;
      break;
    }
  }

  const bodyLines = sigAt === -1 ? head : head.slice(0, sigAt);
  const signature = sigAt === -1 ? '' : head.slice(sigAt + 1).join('\n').trim();

  // Collapse runs of blank lines so paragraph spacing is consistent.
  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    body,
    signature,
    quoted,
    /** Paragraphs of the new content, for spaced-out rendering. */
    paragraphs: body ? body.split(/\n{2,}/) : [],
  };
}

/** Rough file-kind for choosing an attachment icon. */
export function fileKind(filename = '', contentType = '') {
  const ext = String(filename).split('.').pop()?.toLowerCase() || '';
  const type = String(contentType).toLowerCase();

  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (type.includes('pdf') || ext === 'pdf') return 'pdf';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || type.includes('spreadsheet')) return 'sheet';
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext) || type.includes('word')) return 'doc';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'file';
}
