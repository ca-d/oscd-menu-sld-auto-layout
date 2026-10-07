<?xml version="1.0" encoding="UTF-8"?>
<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B">
  <Substation name="S1">
    <LNode iedName="IED-SUB" lnClass="LLN0" lnInst="1"/>
    <PowerTransformer name="PTR-SUB" type="PTR">
      <TransformerWinding name="W1" type="PTW">
        <LNode iedName="IED-SUBPTR" lnClass="TCTR" lnInst="1"/>
      </TransformerWinding>
    </PowerTransformer>
    <VoltageLevel name="V1">
      <LNode iedName="IED-VL" lnClass="LLN0" lnInst="1"/>
      <PowerTransformer name="PTR-VL" type="PTR">
        <TransformerWinding name="W1" type="PTW">
          <LNode iedName="IED-VLPTR" lnClass="TCTR" lnInst="1"/>
        </TransformerWinding>
      </PowerTransformer>
      <Bay name="B1">
        <ConductingEquipment name="QB1" type="DIS">
          <LNode iedName="IED-BAY" lnClass="XSWI" lnInst="1"/>
        </ConductingEquipment>
        <ConductingEquipment name="QB2" type="CBR">
          <LNode iedName="IED-VL" lnClass="XCBR" lnInst="1"/>
        </ConductingEquipment>
      </Bay>
      <Bay name="B2">
        <ConductingEquipment name="QB3" type="DIS">
          <LNode iedName="IED-VL" lnClass="XSWI" lnInst="2"/>
        </ConductingEquipment>
      </Bay>
    </VoltageLevel>
    <VoltageLevel name="V2">
      <Bay name="B3">
        <ConductingEquipment name="QB4" type="DIS">
          <LNode iedName="IED-SUB" lnClass="XSWI" lnInst="1"/>
        </ConductingEquipment>
      </Bay>
    </VoltageLevel>
  </Substation>
  <IED name="IED-BAY"/>
  <IED name="IED-VL"/>
  <IED name="IED-SUB"/>
  <IED name="IED-VLPTR"/>
  <IED name="IED-SUBPTR"/>
</SCL>