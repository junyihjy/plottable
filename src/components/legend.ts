///<reference path="../reference.ts" />

module Plottable {
export module Components {
  export class Legend extends Component {
    /**
     * The css class applied to each legend row
     */
    public static LEGEND_ROW_CLASS = "legend-row";
    /**
     * The css class applied to each legend entry
     */
    public static LEGEND_ENTRY_CLASS = "legend-entry";
    /**
     * The css class applied to each legend symbol
     */
    public static LEGEND_SYMBOL_CLASS = "legend-symbol";

    private _padding = 5;
    private _scale: Scales.Color;
    private _maxEntriesPerRow: number;
    private _comparator: (a: string, b: string) => number;
    private _measurer: SVGTypewriter.Measurers.Measurer;
    private _wrapper: SVGTypewriter.Wrappers.Wrapper;
    private _writer: SVGTypewriter.Writers.Writer;
    private _symbolFactoryAccessor: (datum: any, index: number) => SymbolFactory;
    private _redrawCallback: ScaleCallback<Scales.Color>;

    /**
     * Creates a Legend.
     *
     * The Legend consists of a series of entries, each with a color and label taken from the `scale`.
     * The entries will be displayed in the order of the `scale` domain.
     *
     * @constructor
     * @param {Scale.Color} scale
     */
    constructor(scale: Scales.Color) {
      super();
      this.classed("legend", true);
      this.maxEntriesPerRow(1);

      if (scale == null ) {
        throw new Error("Legend requires a colorScale");
      }

      this._scale = scale;
      this._redrawCallback = (scale) => this.redraw();
      this._scale.onUpdate(this._redrawCallback);

      this.xAlignment("right").yAlignment("top");
      this.comparator((a: string, b: string) => this._scale.domain().indexOf(a) - this._scale.domain().indexOf(b));
      this._symbolFactoryAccessor = () => SymbolFactories.circle();
    }

    protected _setup() {
      super._setup();
      var fakeLegendRow = this._content.append("g").classed(Legend.LEGEND_ROW_CLASS, true);
      var fakeLegendEntry = fakeLegendRow.append("g").classed(Legend.LEGEND_ENTRY_CLASS, true);
      fakeLegendEntry.append("text");
      this._measurer = new SVGTypewriter.Measurers.Measurer(fakeLegendRow);
      this._wrapper = new SVGTypewriter.Wrappers.Wrapper().maxLines(1);
      this._writer = new SVGTypewriter.Writers.Writer(this._measurer, this._wrapper).addTitleElement(true);
    }

    /**
     * Gets the current max number of entries in Legend row.
     * @returns {number} The current max number of entries in row.
     */
    public maxEntriesPerRow(): number;
    /**
     * Sets a new max number of entries in Legend row.
     *
     * @param {number} numEntries If provided, the new max number of entries in row.
     * @returns {Legend} The calling Legend.
     */
    public maxEntriesPerRow(numEntries: number): Legend;
    public maxEntriesPerRow(numEntries?: number): any {
      if (numEntries == null) {
        return this._maxEntriesPerRow;
      } else {
        this._maxEntriesPerRow = numEntries;
        this.redraw();
        return this;
      }
    }

    /**
     * Gets the current comparator for the Legend's entries.
     * @returns {(a: string, b: string) => number} The current comparator.
     */
    public comparator(): (a: string, b: string) => number;
    /**
     * Sets a new comparator for the Legend's entries.
     *
     * @param {(a: string, b: string) => number} comparator If provided, the new comparator.
     * @returns {Legend} The calling Legend.
     */
    public comparator(comparator: (a: string, b: string) => number): Legend;
    public comparator(comparator?: (a: string, b: string) => number): any {
      if (comparator == null) {
        return this._comparator;
      } else {
        this._comparator = comparator;
        this.redraw();
        return this;
      }
    }

    /**
     * Gets the current color scale from the Legend.
     *
     * @returns {ColorScale} The current color scale.
     */
    public scale(): Scales.Color;
    /**
     * Assigns a new color scale to the Legend.
     *
     * @param {Scale.Color} scale If provided, the new scale.
     * @returns {Legend} The calling Legend.
     */
    public scale(scale: Scales.Color): Legend;
    public scale(scale?: Scales.Color): any {
      if (scale != null) {
        this._scale.offUpdate(this._redrawCallback);
        this._scale = scale;
        this._scale.onUpdate(this._redrawCallback);
        this.redraw();
        return this;
      } else {
        return this._scale;
      }
    }

    public destroy() {
      super.destroy();
      this._scale.offUpdate(this._redrawCallback);
    }

    private _calculateLayoutInfo(availableWidth: number, availableHeight: number) {
      var textHeight = this._measurer.measure().height;

      var availableWidthForEntries = Math.max(0, (availableWidth - this._padding));

      var entryNames = this._scale.domain().slice();
      entryNames.sort(this.comparator());

      var entryLengths: D3.Map<number> = d3.map();
      var untruncatedEntryLengths: D3.Map<number> = d3.map();
      entryNames.forEach((entryName) => {
        var untruncatedEntryLength = textHeight + this._measurer.measure(entryName).width + this._padding;
        var entryLength = Math.min(untruncatedEntryLength, availableWidthForEntries);
        entryLengths.set(entryName, entryLength);
        untruncatedEntryLengths.set(entryName, untruncatedEntryLength);
      });

      var rows = this._packRows(availableWidthForEntries, entryNames, entryLengths);

      var rowsAvailable = Math.floor((availableHeight - 2 * this._padding) / textHeight);
      if (rowsAvailable !== rowsAvailable) { // rowsAvailable can be NaN if this.textHeight = 0
        rowsAvailable = 0;
      }

      return {
        textHeight: textHeight,
        entryLengths: entryLengths,
        untruncatedEntryLengths: untruncatedEntryLengths,
        rows: rows,
        numRowsToDraw: Math.max(Math.min(rowsAvailable, rows.length), 0)
      };
    }

    public requestedSpace(offeredWidth: number, offeredHeight: number): SpaceRequest {
      var estimatedLayout = this._calculateLayoutInfo(offeredWidth, offeredHeight);

      var untruncatedRowLengths = estimatedLayout.rows.map((row) => {
        return d3.sum(row, (entry) => estimatedLayout.untruncatedEntryLengths.get(entry));
      });
      var longestUntruncatedRowLength = Utils.Methods.max(untruncatedRowLengths, 0);

      return {
        minWidth: this._padding + longestUntruncatedRowLength,
        minHeight: estimatedLayout.rows.length * estimatedLayout.textHeight + 2 * this._padding
      };
    }

    private _packRows(availableWidth: number, entries: string[], entryLengths: D3.Map<number>) {
      var rows: string[][] = [];
      var currentRow: string[] = [];
      var spaceLeft = availableWidth;
      entries.forEach((e: string) => {
        var entryLength = entryLengths.get(e);
        if (entryLength > spaceLeft || currentRow.length === this._maxEntriesPerRow) {
          rows.push(currentRow);
          currentRow = [];
          spaceLeft = availableWidth;
        }
        currentRow.push(e);
        spaceLeft -= entryLength;
      });

      if (currentRow.length !== 0) {
        rows.push(currentRow);
      }
      return rows;
    }

    /**
     * Gets the legend entry under the given pixel position.
     *
     * @param {Point} position The pixel position.
     * @returns {D3.Selection} The selected entry, or null selection if no entry was selected.
     */
    public getEntry(position: Point): D3.Selection {
      if (!this._isSetup) {
        return d3.select();
      }

      var entry = d3.select();
      var layout = this._calculateLayoutInfo(this.width(), this.height());
      var legendPadding = this._padding;
      this._content.selectAll("g." + Legend.LEGEND_ROW_CLASS).each(function(d: any, i: number) {
        var lowY = i * layout.textHeight + legendPadding;
        var highY = (i + 1) * layout.textHeight + legendPadding;
        var lowX = legendPadding;
        var highX = legendPadding;
        d3.select(this).selectAll("g." + Legend.LEGEND_ENTRY_CLASS).each(function(value: string) {
          highX += layout.entryLengths.get(value);
          if (highX >= position.x && lowX <= position.x &&
              highY >= position.y && lowY <= position.y) {
            entry = d3.select(this);
          }
          lowX += layout.entryLengths.get(value);
        });
      });

      return entry;
    }

    public renderImmediately() {
      super.renderImmediately();

      var layout = this._calculateLayoutInfo(this.width(), this.height());

      var rowsToDraw = layout.rows.slice(0, layout.numRowsToDraw);
      var rows = this._content.selectAll("g." + Legend.LEGEND_ROW_CLASS).data(rowsToDraw);
      rows.enter().append("g").classed(Legend.LEGEND_ROW_CLASS, true);
      rows.exit().remove();

      rows.attr("transform", (d: any, i: number) => "translate(0, " + (i * layout.textHeight + this._padding) + ")");

      var entries = rows.selectAll("g." + Legend.LEGEND_ENTRY_CLASS).data((d) => d);
      var entriesEnter = entries.enter().append("g").classed(Legend.LEGEND_ENTRY_CLASS, true);
      entriesEnter.append("path");
      entriesEnter.append("g").classed("text-container", true);
      entries.exit().remove();

      var legendPadding = this._padding;
      rows.each(function (values: string[]) {
        var xShift = legendPadding;
        var entriesInRow = d3.select(this).selectAll("g." + Legend.LEGEND_ENTRY_CLASS);
        entriesInRow.attr("transform", (value: string, i: number) => {
          var translateString = "translate(" + xShift + ", 0)";
          xShift += layout.entryLengths.get(value);
          return translateString;
        });
      });

      entries.select("path").attr("d", (d: any, i: number) => this.symbolFactoryAccessor()(d, i)(layout.textHeight * 0.6))
                            .attr("transform", "translate(" + (layout.textHeight / 2) + "," + layout.textHeight / 2 + ")")
                            .attr("fill", (value: string) => this._scale.scale(value) )
                            .classed(Legend.LEGEND_SYMBOL_CLASS, true);

      var padding = this._padding;
      var textContainers = entries.select("g.text-container");
      textContainers.text(""); // clear out previous results
      textContainers.append("title").text((value: string) => value);
      var self = this;
      textContainers.attr("transform", "translate(" + layout.textHeight + ", 0)")
                    .each(function(value: string) {
                      var container = d3.select(this);
                      var maxTextLength = layout.entryLengths.get(value) - layout.textHeight - padding;
                      var writeOptions = {
                        selection: container,
                        xAlign: "left",
                        yAlign: "top",
                        textRotation: 0
                      };

                      self._writer.write(value, maxTextLength, self.height(), writeOptions);
                    });
      return this;
    }

    /**
     * Gets the symbolFactoryAccessor of the legend, which dictates how
     * the symbol in each entry is drawn.
     *
     * @returns {(datum: any, index: number) => symbolFactory} The symbolFactory accessor of the legend
     */
    public symbolFactoryAccessor(): (datum: any, index: number) => SymbolFactory;
    /**
     * Sets the symbolFactoryAccessor of the legend
     *
     * @param {(datum: any, index: number) => symbolFactory}  The symbolFactory accessor to set to
     * @returns {Legend} The calling Legend
     */
    public symbolFactoryAccessor(symbolFactoryAccessor: (datum: any, index: number) => SymbolFactory): Legend;
    public symbolFactoryAccessor(symbolFactoryAccessor?: (datum: any, index: number) => SymbolFactory): any {
      if (symbolFactoryAccessor == null) {
        return this._symbolFactoryAccessor;
      } else {
        this._symbolFactoryAccessor = symbolFactoryAccessor;
        this.render();
        return this;
      }
    }

    public fixedWidth() {
      return true;
    }

    public fixedHeight() {
      return true;
    }
  }
}
}
