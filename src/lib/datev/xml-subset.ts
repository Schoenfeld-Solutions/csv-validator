export type XmlNode = {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlNode[];
};

export interface XmlSubsetParseResult {
  readonly root?: XmlNode;
  readonly trailingText: boolean;
  readonly unsupportedNode: boolean;
}

export const parseXmlSubset = (xml: string): XmlSubsetParseResult => {
  const stack: Array<{
    readonly name: string;
    readonly attributes: Readonly<Record<string, string>>;
    readonly children: XmlNode[];
  }> = [];
  let root: XmlNode | undefined;
  let cursor = 0;
  let trailingText = false;
  let unsupportedNode = false;
  const tagPattern = /<[^>]+>/g;

  for (const match of xml.matchAll(tagPattern)) {
    const tag = match[0];
    const index = match.index ?? 0;
    const textBetweenTags = xml.slice(cursor, index).trim();
    if (textBetweenTags !== "") {
      if (stack.length > 0) {
        unsupportedNode = true;
      } else {
        trailingText = true;
      }
    }
    cursor = index + tag.length;

    if (tag.startsWith("<!--")) {
      if (!tag.endsWith("-->")) unsupportedNode = true;
      continue;
    }
    if (tag.startsWith("<!") || tag.startsWith("<?")) {
      unsupportedNode = true;
      continue;
    }
    if (tag.startsWith("</")) {
      const name = tag.slice(2, -1).trim();
      const current = stack.pop();
      if (!current || current.name !== name) {
        unsupportedNode = true;
        continue;
      }
      const completed: XmlNode = {
        attributes: current.attributes,
        children: current.children,
        name: current.name,
      };
      const parent = stack.at(-1);
      if (parent) {
        parent.children.push(completed);
      } else if (root) {
        unsupportedNode = true;
      } else {
        root = completed;
      }
      continue;
    }

    const selfClosing = tag.endsWith("/>");
    const body = tag.slice(1, selfClosing ? -2 : -1).trim();
    const spaceIndex = body.search(/\s/);
    const name = spaceIndex === -1 ? body : body.slice(0, spaceIndex);
    const attributesText = spaceIndex === -1 ? "" : body.slice(spaceIndex + 1);
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) {
      unsupportedNode = true;
      continue;
    }
    const attributes = parseAttributes(attributesText);
    if (!attributes) {
      unsupportedNode = true;
      continue;
    }
    const node = { attributes, children: [], name };
    if (selfClosing) {
      const parent = stack.at(-1);
      if (parent) {
        parent.children.push(node);
      } else if (root) {
        unsupportedNode = true;
      } else {
        root = node;
      }
    } else {
      stack.push(node);
    }
  }

  if (xml.slice(cursor).trim() !== "") {
    trailingText = true;
  }
  if (stack.length > 0) {
    unsupportedNode = true;
  }

  return { root, trailingText, unsupportedNode };
};

const parseAttributes = (
  attributesText: string
): Readonly<Record<string, string>> | undefined => {
  const attributes: Record<string, string> = {};
  let cursor = 0;
  const attributePattern = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(["'])(.*?)\2/gs;
  for (const match of attributesText.matchAll(attributePattern)) {
    const index = match.index ?? 0;
    if (attributesText.slice(cursor, index).trim() !== "") return undefined;
    const [, name, , value] = match;
    const decoded = value === undefined ? undefined : decodeXmlAttribute(value);
    if (!name || decoded === undefined || attributes[name] !== undefined) {
      return undefined;
    }
    attributes[name] = decoded;
    cursor = index + match[0].length;
  }
  if (attributesText.slice(cursor).trim() !== "") return undefined;
  return attributes;
};

const decodeXmlAttribute = (value: string): string | undefined => {
  let decoded = "";
  let cursor = 0;
  const referencePattern = /&(quot|apos|lt|gt|amp|#x[0-9A-Fa-f]+|#[0-9]+);/g;

  for (const match of value.matchAll(referencePattern)) {
    const index = match.index ?? 0;
    const text = value.slice(cursor, index);
    if (text.includes("&")) return undefined;

    const [, reference] = match;
    const character = reference ? decodeXmlReference(reference) : undefined;
    if (character === undefined) return undefined;

    decoded += text + character;
    cursor = index + match[0].length;
  }

  const trailingText = value.slice(cursor);
  if (trailingText.includes("&")) return undefined;
  return decoded + trailingText;
};

const decodeXmlReference = (reference: string): string | undefined => {
  if (reference === "quot") return '"';
  if (reference === "apos") return "'";
  if (reference === "lt") return "<";
  if (reference === "gt") return ">";
  if (reference === "amp") return "&";

  const codePoint = reference.startsWith("#x")
    ? Number.parseInt(reference.slice(2), 16)
    : reference.startsWith("#")
      ? Number.parseInt(reference.slice(1), 10)
      : Number.NaN;

  if (!Number.isInteger(codePoint) || !isXmlCharacter(codePoint)) {
    return undefined;
  }

  return String.fromCodePoint(codePoint);
};

const isXmlCharacter = (codePoint: number): boolean =>
  codePoint === 0x9 ||
  codePoint === 0xa ||
  codePoint === 0xd ||
  (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
  (codePoint >= 0xe000 && codePoint <= 0xfffd) ||
  (codePoint >= 0x10000 && codePoint <= 0x10ffff);
