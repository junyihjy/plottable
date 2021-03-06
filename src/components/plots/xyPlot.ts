///<reference path="../../reference.ts" />

module Plottable {
  export class XYPlot<X, Y> extends Plot {
    protected static _X_KEY = "x";
    protected static _Y_KEY = "y";
    private _autoAdjustXScaleDomain = false;
    private _autoAdjustYScaleDomain = false;
    private _adjustYDomainOnChangeFromXCallback: ScaleCallback<Scale<any, any>>;
    private _adjustXDomainOnChangeFromYCallback: ScaleCallback<Scale<any, any>>;

    /**
     * Constructs an XYPlot.
     *
     * An XYPlot is a plot from drawing 2-dimensional data. Common examples
     * include Scale.Line and Scale.Bar.
     *
     * @constructor
     * @param {any[]|Dataset} [dataset] The data or Dataset to be associated with this Renderer.
     * @param {Scale} xScale The x scale to use.
     * @param {Scale} yScale The y scale to use.
     */
    constructor(xScale: Scale<X, number>, yScale: Scale<Y, number>) {
      super();
      if (xScale == null || yScale == null) {
        throw new Error("XYPlots require an xScale and yScale");
      }
      this.classed("xy-plot", true);

      this._propertyBindings.set(XYPlot._X_KEY, { accessor: null, scale: xScale });
      this._propertyBindings.set(XYPlot._Y_KEY, { accessor: null, scale: yScale });

      this._adjustYDomainOnChangeFromXCallback = (scale) => this._adjustYDomainOnChangeFromX();
      this._adjustXDomainOnChangeFromYCallback = (scale) => this._adjustXDomainOnChangeFromY();

      xScale.onUpdate(this._adjustYDomainOnChangeFromXCallback);
      yScale.onUpdate(this._adjustXDomainOnChangeFromYCallback);
    }

    public x(): Plots.AccessorScaleBinding<X, number>;
    public x(x: number | Accessor<number>): XYPlot<X, Y>;
    public x(x: X | Accessor<X>, xScale: Scale<X, number>): XYPlot<X, Y>;
    public x(x?: number | Accessor<number> | X | Accessor<X>, xScale?: Scale<X, number>): any {
      if (x == null) {
        return this._propertyBindings.get(XYPlot._X_KEY);
      }
      this._bindProperty(XYPlot._X_KEY, x, xScale);
      if (this._autoAdjustYScaleDomain) {
        this._updateYExtentsAndAutodomain();
      }
      this.render();
      return this;
    }

    public y(): Plots.AccessorScaleBinding<Y, number>;
    public y(y: number | Accessor<number>): XYPlot<X, Y>;
    public y(y: Y | Accessor<Y>, yScale: Scale<Y, number>): XYPlot<X, Y>;
    public y(y?: number | Accessor<number> | Y | Accessor<Y>, yScale?: Scale<Y, number>): any {
      if (y == null) {
        return this._propertyBindings.get(XYPlot._Y_KEY);
      }

      this._bindProperty(XYPlot._Y_KEY, y, yScale);
      if (this._autoAdjustXScaleDomain) {
        this._updateXExtentsAndAutodomain();
      }
      this.render();
      return this;
    }

    protected _filterForProperty(property: string) {
      if (property === "x" && this._autoAdjustXScaleDomain) {
        return this._makeFilterByProperty("y");
      } else if (property === "y" && this._autoAdjustYScaleDomain) {
        return this._makeFilterByProperty("x");
      }
      return null;
    }

    private _makeFilterByProperty(property: string) {
      var binding = this._propertyBindings.get(property);
      if (binding != null) {
        var accessor = binding.accessor;
        var scale = binding.scale;
        if (scale != null) {
          return (datum: any, index: number, dataset: Dataset) => {
            var range = scale.range();
            return Utils.Methods.inRange(scale.scale(accessor(datum, index, dataset)), range[0], range[1]);
          };
        }
      }
      return null;
    }

    protected _uninstallScaleForKey(scale: Scale<any, any>, key: string) {
      super._uninstallScaleForKey(scale, key);
      var adjustCallback = key === XYPlot._X_KEY ? this._adjustYDomainOnChangeFromXCallback
                                                 : this._adjustXDomainOnChangeFromYCallback;
      scale.offUpdate(adjustCallback);
    }

    protected _installScaleForKey(scale: Scale<any, any>, key: string) {
      super._installScaleForKey(scale, key);
      var adjustCallback = key === XYPlot._X_KEY ? this._adjustYDomainOnChangeFromXCallback
                                                 : this._adjustXDomainOnChangeFromYCallback;
      scale.onUpdate(adjustCallback);
    }

    public destroy() {
      super.destroy();
      if (this.x().scale) {
        this.x().scale.offUpdate(this._adjustYDomainOnChangeFromXCallback);
      }
      if (this.y().scale) {
        this.y().scale.offUpdate(this._adjustXDomainOnChangeFromYCallback);
      }
      return this;
    }

    /** 
     * Sets the automatic domain adjustment for visible points to operate against the X scale, Y scale, or neither.  
     * 
     * If 'x' or 'y' is specified the adjustment is immediately performed.
     * 
     * @param {string} scale Must be one of 'x', 'y', or 'none'.  
     * 
     * 'x' will adjust the x scale in relation to changes in the y domain.  
     * 
     * 'y' will adjust the y scale in relation to changes in the x domain.
     * 
     * 'none' means neither scale will change automatically.
     * 
     * @returns {XYPlot} The calling XYPlot.
     */
    public autorange(scaleName: string) {
      switch (scaleName) {
        case "x":
          this._autoAdjustXScaleDomain = true;
          this._autoAdjustYScaleDomain = false;
          this._adjustXDomainOnChangeFromY();
          break;
        case "y":
          this._autoAdjustXScaleDomain = false;
          this._autoAdjustYScaleDomain = true;
          this._adjustYDomainOnChangeFromX();
          break;
        case "none":
          this._autoAdjustXScaleDomain = false;
          this._autoAdjustYScaleDomain = false;
          break;
        default:
          throw new Error("Invalid scale name '" + scaleName + "', must be 'x', 'y' or 'none'");
      }
      return this;
    }

    protected _propertyProjectors(): AttributeToProjector {
      var attrToProjector = super._propertyProjectors();
      var positionXFn = attrToProjector["x"];
      var positionYFn = attrToProjector["y"];
      attrToProjector["defined"] = (d: any, i: number, dataset: Dataset) => {
        var positionX = positionXFn(d, i, dataset);
        var positionY = positionYFn(d, i, dataset);
        return positionX != null && positionX === positionX &&
               positionY != null && positionY === positionY;
      };
      return attrToProjector;
    }

    public computeLayout(origin?: Point, availableWidth?: number, availableHeight?: number) {
      super.computeLayout(origin, availableWidth, availableHeight);
      var xScale = this.x().scale;
      if (xScale != null) {
        xScale.range([0, this.width()]);
      }
      var yScale = this.y().scale;
      if (yScale != null) {
        if (this.y().scale instanceof Scales.Category) {
          this.y().scale.range([0, this.height()]);
        } else {
          this.y().scale.range([this.height(), 0]);
        }
      }
      return this;
    }

    private _updateXExtentsAndAutodomain() {
      this._updateExtentsForProperty("x");
      var xScale = this.x().scale;
      if (xScale != null) {
        xScale.autoDomain();
      }
    }

    private _updateYExtentsAndAutodomain() {
      this._updateExtentsForProperty("y");
      var yScale = this.y().scale;
      if (yScale != null) {
        yScale.autoDomain();
      }
    }

    /**
     * Adjusts both domains' extents to show all datasets.
     *
     * This call does not override auto domain adjustment behavior over visible points.
     */
    public showAllData() {
      this._updateXExtentsAndAutodomain();
      this._updateYExtentsAndAutodomain();
      return this;
    }

    private _adjustYDomainOnChangeFromX() {
      if (!this._projectorsReady()) { return; }
      if (this._autoAdjustYScaleDomain) {
        this._updateYExtentsAndAutodomain();
      }
    }
    private _adjustXDomainOnChangeFromY() {
      if (!this._projectorsReady()) { return; }
      if (this._autoAdjustXScaleDomain) {
        this._updateXExtentsAndAutodomain();
      }
    }

    protected _projectorsReady() {
      return this.x().accessor != null && this.y().accessor != null;
    }
  }
}
