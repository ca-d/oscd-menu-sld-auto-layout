import { identity } from '@openscd/scl-lib';
export const privType = 'OpenSCD-SLD-Layout';
export const sldNs = 'https://openscd.org/SCL/SSD/SLD/v0';
export const xmlnsNs = 'http://www.w3.org/2000/xmlns/';
function isIedReferenceElement(element) {
    return (element.localName === 'Reference' &&
        element.namespaceURI === sldNs &&
        element.getAttributeNS(sldNs, 'type') === 'IED');
}
export function iedReferences(root) {
    return Array.from(root.getElementsByTagNameNS(sldNs, 'Reference')).filter(isIedReferenceElement);
}
export function resolveIed(reference) {
    if (!isIedReferenceElement(reference))
        return null;
    const referenceIdentity = reference.getAttributeNS(sldNs, 'id');
    if (!referenceIdentity)
        return null;
    return (Array.from(reference.ownerDocument.querySelectorAll(':root > IED')).find(ied => identity(ied) === referenceIdentity) ?? null);
}
function sldAttributes(element) {
    if (isIedReferenceElement(element))
        return element.querySelector(':scope > SLDAttributes');
    return (element.querySelector(`:scope > Private[type="${privType}"] > SLDAttributes`) ??
        null);
}
export function getSLDAttributes(element, key) {
    return sldAttributes(element)?.getAttributeNS(sldNs, key) ?? null;
}
//# sourceMappingURL=layout-util.js.map