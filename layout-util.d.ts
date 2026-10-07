export declare const privType = "OpenSCD-SLD-Layout";
export declare const sldNs = "https://openscd.org/SCL/SSD/SLD/v0";
export declare const xmlnsNs = "http://www.w3.org/2000/xmlns/";
export declare function iedReferences(root: XMLDocument | Element): Element[];
export declare function resolveIed(reference: Element): Element | null;
export declare function getSLDAttributes(element: Element, key: string): string | null;
