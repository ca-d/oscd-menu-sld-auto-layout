import { getReference, identity } from '@openscd/scl-lib';
import { getSLDAttributes, iedReferences, privType, resolveIed, sldNs, xmlnsNs, } from './layout-util.js';
const bayWidth = 7;
const bayRowStart = 2;
const rowStep = 2;
const minContainerSize = 4;
function addUnique(map, key, value) {
    const values = map.get(key) ?? [];
    if (!values.includes(value))
        values.push(value);
    map.set(key, values);
}
function sortByName(elements) {
    return [...elements].sort((a, b) => {
        const aName = a.getAttribute('name') ?? '';
        const bName = b.getAttribute('name') ?? '';
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
    });
}
function directChildrenByTag(container, ...tagNames) {
    return Array.from(container.children).filter(child => tagNames.includes(child.tagName));
}
function directChildByLocalName(parent, localName) {
    return (Array.from(parent.children).find(child => child.localName === localName) ??
        null);
}
function referenceInsertPoint(privateElement) {
    return (Array.from(privateElement.children).find(child => child.localName === 'Reference') ?? null);
}
function layoutPrivate(container) {
    return (Array.from(container.children).find(child => child.tagName === 'Private' && child.getAttribute('type') === privType) ?? null);
}
function applyDetachedAttributes(target, nsp, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
        target.setAttributeNS(sldNs, `${nsp}:${key}`, value);
    });
}
function namespacedAttributesEdit(target, nsp, attributes) {
    return {
        element: target,
        attributesNS: {
            [sldNs]: Object.fromEntries(Object.entries(attributes).map(([key, value]) => [`${nsp}:${key}`, value])),
        },
    };
}
function iedLayoutAttributes(x, y) {
    return {
        x: x.toString(),
        y: y.toString(),
        lx: (x + 1).toString(),
        ly: (y + 1).toString(),
    };
}
function equipmentLayoutAttributes(equipment, x, y) {
    if (equipment.tagName === 'PowerTransformer') {
        return {
            x: x.toString(),
            y: y.toString(),
            rot: '0',
            lx: (x + 1.5).toString(),
            ly: y.toString(),
        };
    }
    return {
        x: x.toString(),
        y: y.toString(),
        rot: '0',
        lx: (x + 1).toString(),
        ly: (y + 1).toString(),
    };
}
function containerLayoutAttributes(x, y, w, h) {
    return {
        x: x.toString(),
        y: y.toString(),
        lx: x.toString(),
        ly: y.toString(),
        w: w.toString(),
        h: h.toString(),
    };
}
function descendantLNodes(element) {
    return Array.from(element.getElementsByTagName('LNode'));
}
function containsReference(element, iedName) {
    return descendantLNodes(element).some(lNode => lNode.getAttribute('iedName') === iedName);
}
function isReferencedItself(element, iedName) {
    return Array.from(element.children).some(child => child.tagName === 'LNode' && child.getAttribute('iedName') === iedName);
}
function hasReferencedChildren(element, iedName) {
    const threshold = element.tagName === 'Bay' ? 0 : 1;
    return (Array.from(element.children).filter(child => containsReference(child, iedName))
        .length > threshold);
}
function hasReferencedPrimaryChildren(element, iedName) {
    if (!['Substation', 'VoltageLevel'].includes(element.tagName))
        return false;
    return Array.from(element.children).some(child => ['PowerTransformer', 'ConductingEquipment'].includes(child.tagName) &&
        containsReference(child, iedName));
}
function hasOurs(element, iedName) {
    return descendantLNodes(element).some(lNode => lNode.getAttribute('iedName') === iedName);
}
function getOurs(element, iedName) {
    return descendantLNodes(element).filter(lNode => lNode.getAttribute('iedName') === iedName);
}
function hasTheirs(element, iedName) {
    const ours = getOurs(element, iedName);
    const scl = element.ownerDocument.documentElement;
    return descendantLNodes(scl)
        .filter(lNode => lNode.getAttribute('iedName') === iedName)
        .some(lNode => !ours.includes(lNode));
}
function attachedIedsFor(element, ieds) {
    const attached = ieds.filter(ied => {
        const iedName = ied.getAttribute('name');
        if (!iedName)
            return false;
        if (element.tagName === 'SCL')
            return !hasOurs(element, iedName) || hasReferencedChildren(element, iedName);
        if (hasTheirs(element, iedName))
            return false;
        return (isReferencedItself(element, iedName) ||
            hasReferencedChildren(element, iedName) ||
            hasReferencedPrimaryChildren(element, iedName));
    });
    return sortByName(attached);
}
function classifyIeds(substation) {
    const ieds = Array.from(substation.ownerDocument.querySelectorAll(':root > IED'));
    const voltageLevelIeds = new Map();
    const bayIeds = new Map();
    const substationIeds = attachedIedsFor(substation, ieds);
    const placedIds = new Set(substationIeds.map(ied => String(identity(ied))));
    directChildrenByTag(substation, 'VoltageLevel').forEach(voltageLevel => {
        const attachedToVoltageLevel = attachedIedsFor(voltageLevel, ieds);
        if (attachedToVoltageLevel.length) {
            voltageLevelIeds.set(voltageLevel, attachedToVoltageLevel);
            attachedToVoltageLevel.forEach(ied => placedIds.add(String(identity(ied))));
        }
        directChildrenByTag(voltageLevel, 'Bay').forEach(bay => {
            const attachedToBay = attachedIedsFor(bay, ieds);
            if (attachedToBay.length) {
                bayIeds.set(bay, attachedToBay);
                attachedToBay.forEach(ied => placedIds.add(String(identity(ied))));
            }
        });
    });
    iedReferences(substation).forEach(reference => {
        const ied = resolveIed(reference);
        if (!ied)
            return;
        const id = String(identity(ied));
        if (placedIds.has(id))
            return;
        const container = reference.parentElement?.tagName === 'Private'
            ? reference.parentElement.parentElement
            : null;
        if (!container)
            return;
        if (container.tagName === 'Bay')
            addUnique(bayIeds, container, ied);
        else if (container.tagName === 'VoltageLevel')
            addUnique(voltageLevelIeds, container, ied);
        else
            substationIeds.push(ied);
        placedIds.add(id);
    });
    voltageLevelIeds.forEach((voltageLevelScopedIeds, voltageLevel) => {
        voltageLevelIeds.set(voltageLevel, sortByName(voltageLevelScopedIeds));
    });
    bayIeds.forEach((bayScopedIeds, bay) => {
        bayIeds.set(bay, sortByName(bayScopedIeds));
    });
    return {
        substation: sortByName(substationIeds),
        voltageLevels: voltageLevelIeds,
        bays: bayIeds,
    };
}
function createReferencePool(substation) {
    const byIdentity = new Map();
    iedReferences(substation).forEach(reference => {
        const ied = resolveIed(reference);
        if (!ied)
            return;
        const id = String(identity(ied));
        const references = byIdentity.get(id) ?? [];
        references.push(reference);
        byIdentity.set(id, references);
    });
    return { byIdentity, used: new Set() };
}
function claimReference(pool, ied) {
    const id = String(identity(ied));
    const references = pool.byIdentity.get(id) ?? [];
    const reference = references.find(candidate => !pool.used.has(candidate));
    if (reference)
        pool.used.add(reference);
    return reference;
}
class EditBuilder {
    constructor(doc, nsp) {
        this.doc = doc;
        this.nsp = nsp;
        this.privateCache = new Map();
        this.edits = [];
    }
    ensureNamespaceDeclaration() {
        if (this.doc.documentElement.lookupPrefix(sldNs))
            return;
        this.edits.push({
            element: this.doc.documentElement,
            attributesNS: {
                [xmlnsNs]: {
                    [`xmlns:${this.nsp}`]: sldNs,
                },
            },
        });
    }
    getOrCreatePrivate(container) {
        const cached = this.privateCache.get(container);
        if (cached)
            return cached;
        const existingPrivate = layoutPrivate(container);
        if (existingPrivate) {
            const existing = { node: existingPrivate, isNew: false };
            this.privateCache.set(container, existing);
            return existing;
        }
        const privateElement = this.doc.createElementNS(this.doc.documentElement.namespaceURI, 'Private');
        privateElement.setAttribute('type', privType);
        this.edits.push({
            parent: container,
            node: privateElement,
            reference: getReference(container, 'Private'),
        });
        const created = { node: privateElement, isNew: true };
        this.privateCache.set(container, created);
        return created;
    }
    upsertLayoutAttributes(element, attributes) {
        const { node: privateElement, isNew } = this.getOrCreatePrivate(element);
        const existingSldAttributes = isNew
            ? null
            : directChildByLocalName(privateElement, 'SLDAttributes');
        if (existingSldAttributes) {
            this.edits.push(namespacedAttributesEdit(existingSldAttributes, this.nsp, attributes));
            return;
        }
        const sldAttributes = this.doc.createElementNS(sldNs, `${this.nsp}:SLDAttributes`);
        applyDetachedAttributes(sldAttributes, this.nsp, attributes);
        if (isNew) {
            privateElement.insertBefore(sldAttributes, referenceInsertPoint(privateElement));
            return;
        }
        this.edits.push({
            parent: privateElement,
            node: sldAttributes,
            reference: referenceInsertPoint(privateElement),
        });
    }
    placeIed(container, ied, attributes, pool) {
        const { node: privateElement, isNew } = this.getOrCreatePrivate(container);
        const existingReference = claimReference(pool, ied);
        if (!existingReference) {
            const reference = this.doc.createElementNS(sldNs, `${this.nsp}:Reference`);
            reference.setAttributeNS(sldNs, `${this.nsp}:id`, String(identity(ied)));
            reference.setAttributeNS(sldNs, `${this.nsp}:type`, 'IED');
            const sldAttributes = this.doc.createElementNS(sldNs, `${this.nsp}:SLDAttributes`);
            applyDetachedAttributes(sldAttributes, this.nsp, attributes);
            reference.appendChild(sldAttributes);
            if (isNew)
                privateElement.appendChild(reference);
            else
                this.edits.push({ parent: privateElement, node: reference, reference: null });
            return;
        }
        const oldPrivate = existingReference.parentElement;
        if (oldPrivate !== privateElement) {
            this.edits.push({
                parent: privateElement,
                node: existingReference,
                reference: null,
            });
            if (oldPrivate?.tagName === 'Private' &&
                oldPrivate.getAttribute('type') === privType &&
                oldPrivate.childElementCount === 1)
                this.edits.push({ node: oldPrivate });
        }
        const existingSldAttributes = directChildByLocalName(existingReference, 'SLDAttributes');
        if (existingSldAttributes) {
            this.edits.push(namespacedAttributesEdit(existingSldAttributes, this.nsp, attributes));
            return;
        }
        const sldAttributes = this.doc.createElementNS(sldNs, `${this.nsp}:SLDAttributes`);
        applyDetachedAttributes(sldAttributes, this.nsp, attributes);
        this.edits.push({ parent: existingReference, node: sldAttributes, reference: null });
    }
}
function layoutIedRow(container, ieds, x, y, builder, pool) {
    if (!ieds.length)
        return { rightEdge: x + 1, height: 0 };
    let rightEdge = x + 1;
    ieds.forEach((ied, index) => {
        const iedX = x + 1 + index * 2;
        builder.placeIed(container, ied, iedLayoutAttributes(iedX, y), pool);
        rightEdge = iedX + 1;
    });
    return { rightEdge, height: 2 };
}
function layoutEquipmentGrid(container, x, y, builder) {
    const equipments = directChildrenByTag(container, 'ConductingEquipment', 'PowerTransformer');
    if (!equipments.length)
        return { rightEdge: x + 1, height: 0 };
    let rightEdge = x + 1;
    equipments.forEach((equipment, index) => {
        const equipmentX = x + 1 + (index % 2) * 2;
        const equipmentY = y + Math.floor(index / 2) * rowStep;
        builder.upsertLayoutAttributes(equipment, equipmentLayoutAttributes(equipment, equipmentX, equipmentY));
        rightEdge = Math.max(rightEdge, equipmentX + 1);
    });
    return { rightEdge, height: Math.ceil(equipments.length / 2) * rowStep };
}
function layoutBay(bay, x, y, ieds, builder, pool) {
    const equipment = directChildrenByTag(bay, 'ConductingEquipment', 'PowerTransformer');
    const rows = Math.max(1, ieds.length, Math.ceil(equipment.length / 2));
    const height = rows * rowStep + 2;
    builder.upsertLayoutAttributes(bay, containerLayoutAttributes(x, y, bayWidth, height));
    ieds.forEach((ied, index) => {
        builder.placeIed(bay, ied, iedLayoutAttributes(x + 1, y + bayRowStart + index * rowStep), pool);
    });
    equipment.forEach((element, index) => {
        const elementX = x + 3 + (index % 2) * 2;
        const elementY = y + bayRowStart + Math.floor(index / 2) * rowStep;
        builder.upsertLayoutAttributes(element, equipmentLayoutAttributes(element, elementX, elementY));
    });
    return {
        rightEdge: x + bayWidth,
        bottomEdge: y + height,
    };
}
function layoutVoltageLevel(voltageLevel, x, y, scopedIeds, builder, pool) {
    let rightEdge = x + 1;
    let bottomEdge = y + minContainerSize - 1;
    let cursorY = y + 2;
    const sharedIeds = scopedIeds.voltageLevels.get(voltageLevel) ?? [];
    const iedRow = layoutIedRow(voltageLevel, sharedIeds, x, cursorY, builder, pool);
    if (iedRow.height) {
        rightEdge = Math.max(rightEdge, iedRow.rightEdge);
        cursorY += iedRow.height;
        bottomEdge = Math.max(bottomEdge, cursorY);
    }
    const equipmentGrid = layoutEquipmentGrid(voltageLevel, x, cursorY, builder);
    if (equipmentGrid.height) {
        rightEdge = Math.max(rightEdge, equipmentGrid.rightEdge);
        cursorY += equipmentGrid.height;
        bottomEdge = Math.max(bottomEdge, cursorY);
    }
    let bayX = x + 1;
    directChildrenByTag(voltageLevel, 'Bay').forEach(bay => {
        const box = layoutBay(bay, bayX, cursorY, scopedIeds.bays.get(bay) ?? [], builder, pool);
        bayX = box.rightEdge + 1;
        rightEdge = Math.max(rightEdge, box.rightEdge);
        bottomEdge = Math.max(bottomEdge, box.bottomEdge);
    });
    const width = Math.max(minContainerSize, rightEdge - x + 1);
    const height = Math.max(minContainerSize, bottomEdge - y + 1);
    builder.upsertLayoutAttributes(voltageLevel, containerLayoutAttributes(x, y, width, height));
    return {
        rightEdge: x + width,
        bottomEdge: y + height,
    };
}
function layoutSubstation(substation, builder, pool) {
    const scopedIeds = classifyIeds(substation);
    let rightEdge = 1;
    let bottomEdge = minContainerSize - 1;
    let cursorY = 2;
    const iedRow = layoutIedRow(substation, scopedIeds.substation, 0, cursorY, builder, pool);
    if (iedRow.height) {
        rightEdge = Math.max(rightEdge, iedRow.rightEdge);
        cursorY += iedRow.height;
        bottomEdge = Math.max(bottomEdge, cursorY);
    }
    const equipmentGrid = layoutEquipmentGrid(substation, 0, cursorY, builder);
    if (equipmentGrid.height) {
        rightEdge = Math.max(rightEdge, equipmentGrid.rightEdge);
        cursorY += equipmentGrid.height;
        bottomEdge = Math.max(bottomEdge, cursorY);
    }
    directChildrenByTag(substation, 'VoltageLevel').forEach(voltageLevel => {
        const box = layoutVoltageLevel(voltageLevel, 1, cursorY, scopedIeds, builder, pool);
        cursorY = box.bottomEdge + 1;
        rightEdge = Math.max(rightEdge, box.rightEdge);
        bottomEdge = Math.max(bottomEdge, box.bottomEdge);
    });
    const width = Math.max(minContainerSize, rightEdge + 1);
    const height = Math.max(minContainerSize, bottomEdge + 1);
    const existingX = getSLDAttributes(substation, 'x');
    const existingY = getSLDAttributes(substation, 'y');
    builder.upsertLayoutAttributes(substation, {
        ...(existingX ? { x: existingX } : {}),
        ...(existingY ? { y: existingY } : {}),
        ...(existingX ? { lx: existingX } : {}),
        ...(existingY ? { ly: existingY } : {}),
        w: width.toString(),
        h: height.toString(),
    });
}
export function createZeroLineLayoutEdits(doc) {
    const substations = Array.from(doc.querySelectorAll(':root > Substation'));
    if (!substations.length)
        return [];
    const nsp = doc.documentElement.lookupPrefix(sldNs) ?? 'eosld';
    const builder = new EditBuilder(doc, nsp);
    builder.ensureNamespaceDeclaration();
    substations.forEach(substation => {
        layoutSubstation(substation, builder, createReferencePool(substation));
    });
    return builder.edits;
}
//# sourceMappingURL=autolayout.js.map