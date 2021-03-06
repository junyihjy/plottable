///<reference path="../reference.ts" />

module Plottable {
export module Drawers {
  export class Arc extends Element {

    constructor(key: string) {
      super(key);
      this._svgElement = "path";
    }

    private _createArc(innerRadiusF: AppliedProjector, outerRadiusF: AppliedProjector) {
      return d3.svg.arc()
                   .innerRadius(innerRadiusF)
                   .outerRadius(outerRadiusF);
    }

    private _retargetProjectors(attrToProjector: AttributeToAppliedProjector): AttributeToAppliedProjector {
      var retargetedAttrToProjector: AttributeToAppliedProjector = {};
      d3.entries(attrToProjector).forEach((entry) => {
        retargetedAttrToProjector[entry.key] = (d: D3.Layout.ArcDescriptor, i: number) => entry.value(d.data, i);
      });
      return retargetedAttrToProjector;
    }

    public _drawStep(step: AppliedDrawStep) {
      var attrToProjector = <AttributeToAppliedProjector>Utils.Methods.copyMap(step.attrToProjector);
      attrToProjector = this._retargetProjectors(attrToProjector);
      this._attrToProjector = this._retargetProjectors(this._attrToProjector);
      var innerRadiusAccessor = attrToProjector["inner-radius"];
      var outerRadiusAccessor = attrToProjector["outer-radius"];
      delete attrToProjector["inner-radius"];
      delete attrToProjector["outer-radius"];

      attrToProjector["d"] = this._createArc(innerRadiusAccessor, outerRadiusAccessor);
      return super._drawStep({attrToProjector: attrToProjector, animator: step.animator});
    }

    public draw(data: any[], drawSteps: DrawStep[], dataset: Dataset) {
      // HACKHACK Applying metadata should be done in base class
      var valueAccessor = (d: any, i: number) => drawSteps[0].attrToProjector["sector-value"](d, i, dataset);

      data = data.filter(e => Plottable.Utils.Methods.isValidNumber(+valueAccessor(e, null)));

      var pie = d3.layout.pie()
                          .sort(null)
                          .value(valueAccessor)(data);

      drawSteps.forEach(s => delete s.attrToProjector["sector-value"]);
      pie.forEach((slice) => {
        if (slice.value < 0) {
          Utils.Methods.warn("Negative values will not render correctly in a pie chart.");
        }
      });
      return super.draw(pie, drawSteps, dataset);
    }

    public _getPixelPoint(datum: any, index: number): Point {
      var innerRadiusAccessor = this._attrToProjector["inner-radius"];
      var outerRadiusAccessor = this._attrToProjector["outer-radius"];
      var avgRadius = (innerRadiusAccessor(datum, index) + outerRadiusAccessor(datum, index)) / 2;
      var startAngle = +this._getSelection(index).datum().startAngle;
      var endAngle = +this._getSelection(index).datum().endAngle;
      var avgAngle = (startAngle + endAngle) / 2;
      return { x: avgRadius * Math.sin(avgAngle), y: -avgRadius * Math.cos(avgAngle) };
    }
  }
}
}
