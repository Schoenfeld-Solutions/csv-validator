export type XmlNode = {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: readonly XmlNode[];
  readonly text: string;
};

export type XmlSubsetLimitCode =
  | "document-length"
  | "node-count"
  | "depth"
  | "text-length"
  | "total-text-length"
  | "attribute-count"
  | "attribute-length";

export interface XmlSubsetLimits {
  readonly maximumDocumentLength: number;
  readonly maximumNodeCount: number;
  readonly maximumDepth: number;
  readonly maximumTextLength: number;
  readonly maximumTotalTextLength: number;
  readonly maximumAttributesPerNode: number;
  readonly maximumAttributeLength: number;
}

export const DEFAULT_XML_SUBSET_LIMITS: XmlSubsetLimits = {
  maximumDocumentLength: 2 * 1024 * 1024,
  maximumNodeCount: 20_000,
  maximumDepth: 8,
  maximumTextLength: 4_096,
  maximumTotalTextLength: 1024 * 1024,
  maximumAttributesPerNode: 16,
  maximumAttributeLength: 4_096,
};

export interface XmlSubsetParseResult {
  readonly root?: XmlNode;
  readonly trailingText: boolean;
  readonly unsupportedNode: boolean;
  readonly limitExceeded?: XmlSubsetLimitCode;
}

type MutableXmlNode = {
  readonly name: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly children: XmlNode[];
  readonly textParts: string[];
};

type AttributeParseResult =
  | { readonly attributes: Readonly<Record<string, string>> }
  | { readonly unsupported: true }
  | { readonly limitExceeded: XmlSubsetLimitCode };

export const parseXmlSubset = (
  xml: string,
  limitOverrides: Partial<XmlSubsetLimits> = {}
): XmlSubsetParseResult => {
  const limits = { ...DEFAULT_XML_SUBSET_LIMITS, ...limitOverrides };
  if (xml.length > limits.maximumDocumentLength) {
    return {
      limitExceeded: "document-length",
      trailingText: false,
      unsupportedNode: false,
    };
  }

  const stack: MutableXmlNode[] = [];
  let root: XmlNode | undefined;
  let cursor = 0;
  let trailingText = false;
  let unsupportedNode = false;
  let limitExceeded: XmlSubsetLimitCode | undefined;
  let nodeCount = 0;
  let totalTextLength = 0;
  const tagPattern = /<[^>]+>/g;

  const consumeText = (rawText: string): void => {
    if (rawText.trim() === "" || limitExceeded) return;
    const current = stack.at(-1);
    if (!current) {
      trailingText = true;
      return;
    }
    const decoded = decodeXmlValue(rawText);
    if (decoded === undefined) {
      unsupportedNode = true;
      return;
    }
    const normalized = decoded.trim();
    if (normalized.length > limits.maximumTextLength) {
      limitExceeded = "text-length";
      return;
    }
    totalTextLength += normalized.length;
    if (totalTextLength > limits.maximumTotalTextLength) {
      limitExceeded = "total-text-length";
      return;
    }
    current.textParts.push(normalized);
  };

  for (const match of xml.matchAll(tagPattern)) {
    const tag = match[0];
    const index = match.index ?? 0;
    consumeText(xml.slice(cursor, index));
    if (limitExceeded) break;
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
      const text = current.textParts.join("");
      if (current.children.length > 0 && text !== "") {
        unsupportedNode = true;
      }
      const completed: XmlNode = {
        attributes: current.attributes,
        children: current.children,
        name: current.name,
        text,
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
    const parsedAttributes = parseAttributes(attributesText, limits);
    if ("limitExceeded" in parsedAttributes) {
      limitExceeded = parsedAttributes.limitExceeded;
      break;
    }
    if ("unsupported" in parsedAttributes) {
      unsupportedNode = true;
      continue;
    }

    nodeCount += 1;
    if (nodeCount > limits.maximumNodeCount) {
      limitExceeded = "node-count";
      break;
    }
    if (stack.length + 1 > limits.maximumDepth) {
      limitExceeded = "depth";
      break;
    }

    const node: MutableXmlNode = {
      attributes: parsedAttributes.attributes,
      children: [],
      name,
      textParts: [],
    };
    if (selfClosing) {
      const completed: XmlNode = {
        attributes: node.attributes,
        children: node.children,
        name: node.name,
        text: "",
      };
      const parent = stack.at(-1);
      if (parent) {
        parent.children.push(completed);
      } else if (root) {
        unsupportedNode = true;
      } else {
        root = completed;
      }
    } else {
      stack.push(node);
    }
  }

  if (!limitExceeded) {
    consumeText(xml.slice(cursor));
  }
  if (stack.length > 0 && !limitExceeded) {
    unsupportedNode = true;
  }

  return {
    root: limitExceeded ? undefined : root,
    trailingText,
    unsupportedNode,
    limitExceeded,
  };
};

const parseAttributes = (
  attributesText: string,
  limits: XmlSubsetLimits
): AttributeParseResult => {
  const attributes: Record<string, string> = {};
  let cursor = 0;
  let attributeCount = 0;
  const attributePattern = /([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(["'])(.*?)\2/gs;
  for (const match of attributesText.matchAll(attributePattern)) {
    const index = match.index ?? 0;
    if (attributesText.slice(cursor, index).trim() !== "") {
      return { unsupported: true };
    }
    const [, name, , value] = match;
    const decoded = value === undefined ? undefined : decodeXmlValue(value);
    if (!name || decoded === undefined || attributes[name] !== undefined) {
      return { unsupported: true };
    }
    attributeCount += 1;
    if (attributeCount > limits.maximumAttributesPerNode) {
      return { limitExceeded: "attribute-count" };
    }
    if (decoded.length > limits.maximumAttributeLength) {
      return { limitExceeded: "attribute-length" };
    }
    attributes[name] = decoded;
    cursor = index + match[0].length;
  }
  if (attributesText.slice(cursor).trim() !== "") {
    return { unsupported: true };
  }
  return { attributes };
};

const decodeXmlValue = (value: string): string | undefined => {
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

  const trailingValue = value.slice(cursor);
  if (trailingValue.includes("&")) return undefined;
  return decoded + trailingValue;
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
