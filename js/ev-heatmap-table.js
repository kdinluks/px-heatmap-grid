Polymer({

  is: 'ev-heatmap-table',

  properties: {
    /**
     * Holds the data.
     *
     * @property data
     */
    data: {
      type: Object,
      value: [],
      notify: true,
      observer: '_dataChanged'
    },

    /**
     * Holds the rendered data
     *
     * @property heatmapData
     */
    heatmapData: {
      type: Object,
      value: [],
      observer: '_heatmapDataChanged'
    },

    /**
     * Holds the config info
     *
     * @property config
     */
    config: {
      type: Object,
      value: {
        "minValue": 0,
        "maxValue": 0,
        "startColor": [],
        "endColor": [],
        "factors" : []
      },
      observer: '_configChanged'
    },
    /**
     * Holds the scale set by the user
     *
     * @property scale
     */
    scale: {
      type: Array,
      value: [0, 100],
      observer: '_scaleChanged'
    },

    /**
     * Controls when to show/hide the Column Headers
     *
     * @property hideColHeader
     */
    hideColHeader: {
      type: Boolean,
      value: false,
      observer: '_hideColHeaderChanged'
    },

    /**
     * Controls when to show/hide the Row Headers
     *
     * @property hideRowHeader
     */
    hideRowHeader: {
      type: Boolean,
      value: false,
      observer: '_hideRowHeaderChanged',
    },

    /**
     * Controls when to show/hide the Values in the cells
     */
    hideValues: {
      type: Boolean,
      value: false
    },

    /**
     * Sets the aggregation method
     *
     * @property aggregationType
     */
    aggregationType: {
      type: String,
      value: "",
      observer: '_calculateAggregation'
    },

    /**
     * Controls when to show/hide the Aggregations
     *
     * @property showAggregation
     */
    showAggregation: {
      type: Boolean,
      value: false,
      observer: '_showAggregationChanged'
    },

    /**
     * Contains all the available aggregation types
     *
     * @property availableAggregations
     */
    availableAggregations: {
      type: Array,
      value: [
        "AVERAGE",
        "MAX",
        "MIN",
        "SUM",
        "COUNT",
        "STD"
      ]
    },

    /**
     * Contains the Scale From color.
     *
     * @property scaleColorFrom
     */
    scaleColorFrom: {
      type: String,
      observer: '_scaleColorFromChanged'
    },

    /**
     * Contains the Scale To color.
     *
     * @property scaleColorTo
     */
    scaleColorTo: {
      type: String,
      observer: '_scaleColorToChanged'
    }
  },

  /**
   * After the component is attached to the DOM calls
   * _dataChanged and _configChanged.
   * Gets the cell max Width that was set using SASS and
   * saves it in cellMaxWidth.
   * Gets the Row Header max Width that was set using
   * SASS and saves it in rowMaxWidth.
   */
  attached: function() {
    this._dataChanged(this.data, []);
    this._configChanged(this.config, {});

    // Hack to get cell max width set with sass
    var tempEl = document.createElement('div');
    tempEl.style.display = 'none';
    tempEl.classList.add('table-cell');
    Polymer.dom(this.root).appendChild(tempEl);
    this.set('cellMaxWidth', window.getComputedStyle(tempEl).maxWidth);
    tempEl.classList.remove('table-cell');
    tempEl.classList.add('table-row-header');
    this.set('rowMaxWidth', window.getComputedStyle(tempEl).maxWidth);
    Polymer.dom(this.root).removeChild(tempEl);
  },

  /**
   * Observes the changes to data and creates the internal
   * data structure used to render the heatmap table.
   * Saves the initial column ordering in initialColsOrder.
   * Saves the initial row ordering in initialRowsOrder.
   * Triggers the aggregation calculation and the hide/show
   * method to hide/show the titles according to the data.
   *
   * newData accepts 3 different data formats:
   * Array<Object>
   * Array<Array>
   * Array<number>
   *
   * @param {Array<Object|Array|number>} newData The new heatmap data.
   * @param {Array<Object|Array|number>} oldData The old heatmap data.
   *
   * @method _dataChanged
   * @private
   */
  _dataChanged: function(newData, oldData) {
    var self = this;
    if(newData != oldData && newData && newData.length) {
      var rows = [],
        cols = [],
        tableData = [],
        nColor = [],
        iRow = -1,
        iCol = -1,
        initialRowsOrder = [],
        initialColsOrder = [];

      /**
       * Handles the case where newData is an Array<Array>
       * [
       *   [0, 1, 2, 3, 4, 5, 6],
       *   [7, 8, 9, 10, 11, 12, 13],
       *   [14, 15, 16, 17, 18, 19, 20]
       * ]
       *
       */
      if (Array.isArray(newData[0])) {
        newData.forEach(function (colArr, i) {
          colArr.forEach(function (value, j) {
            if(!tableData[j]) tableData.push([]);
            nColor = self.config != undefined ? self._calculateColor(value) : [255, 255, 255];
            tableData[j][i] = {
              "value": value,
              "color": nColor ? "background-color: rgb(" + nColor[0] + "," + nColor[1] + "," + nColor[2] + ");" : ""
            };
          });
        });
      }
      /**
       * Handles the case where newData is an Array<number>
       *
       * [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
       *
       */
      else if (typeof newData[0] !== "object" && typeof newData[0] !== "string") {
        newData.forEach(function (value) {
          nColor = self.config != undefined ? self._calculateColor(value) : [255, 255, 255];
          tableData.push( [{
            "value": value,
            "color": nColor ? "background-color: rgb(" + nColor[0] + "," + nColor[1] + "," + nColor[2] + ");" : ""
          }]);
        });
      }
      /**
       * Handles the case where newData is an Array<Object>
       * and the Object has the property values
       *
       * [
       *   {
       *     "row": "Row Title",
       *     "values": [0, 1, 2, 3, 4, 5]
       *   }
       * ]
       *
       * or
       *
       * [
       *   {
       *     "col": "Column Title",
       *     "values": [0, 1, 2, 3, 4, 5]
       *   }
       * ]
       *
       */
      else if (typeof newData[0] === "object" && newData[0].values) {
        newData.forEach(function (cell, i) {
          iRow = cell.row ? Object.keys(rows).indexOf(cell.row) : -2;
          iCol = cell.col ? Object.keys(cols).indexOf(cell.col) : -2;
          if (iCol === -2) {
            rows[cell.row] = cell.row;
          };
          if (iRow === -2) {
            cols[cell.col] = cell.col;
          };
          cell.values.forEach(function (value, j) {
            nColor = self.config != undefined ? self._calculateColor(value) : [255, 255, 255];
            if (iCol === -2) {
              if (i === 0 ) tableData.push([]);
              tableData[j].push({
                "value": value,
                "color": nColor ? "background-color: rgb(" + nColor[0] + "," + nColor[1] + "," + nColor[2] + ");" : ""
              });
            }
            else {
              if (j === 0 ) tableData.push([]);
              tableData[i].push({
                "value": value,
                "color": nColor ? "background-color: rgb(" + nColor[0] + "," + nColor[1] + "," + nColor[2] + ");" : ""
              });
            }
          });
        });
      }
      /**
       * Finally handles the last newData type where newData
       * is an Array<Object>
       *
       * [
       *   {
       *     "row": "Row Title",
       *     "col": "Column Title",
       *     "value": 10
       *   }
       * ]
       *
       */
      else if (typeof newData[0] !== "string") {
        newData.forEach(function (cell) {
          iRow = Object.keys(rows).indexOf(cell.row);
          iCol = Object.keys(cols).indexOf(cell.col);
          if (iCol === -1) {
            cols[cell.col] = cell.col;
            tableData.push([]);
            iCol = Object.keys(cols).length - 1;
          };
          if (iRow === -1) {
            rows[cell.row] = cell.row;
            iRow = Object.keys(rows).length - 1;
          };
          nColor = self.config != undefined ? self._calculateColor(cell.value) : [255, 255, 255];
          tableData[iCol][iRow] = {
            "value": cell.value,
            "color": nColor ? "background-color: rgb(" + nColor[0] + "," + nColor[1] + "," + nColor[2] + ");" : ""
          };
        });
      };

      // Force set length of array
      rows.length = Object.keys(rows).length;
      cols.length = Object.keys(cols).length;

      this.set("heatmapData", []);
      this.set("rows", rows);
      this.set("cols", cols);
      this.set("heatmapData", tableData);
      this._calculateAggregation(this.aggregationType, "");
      this._hideColHeaderChanged(false, true);
      this._hideRowHeaderChanged(false, true);

      // Saves the initial Rows ordering in initialRowsOrder
      if (this.rows && this.rows.length) {
        for (var i = 0; i < this.rows.length; i++) {
          initialRowsOrder.push({
            index: i,
            value: Object.keys(this.rows)[i]
          });
        }
        this.initialRowsOrder = initialRowsOrder;
      }
      // If there's no row header titles uses the first column of data
      else if (this.heatmapData && this.heatmapData.length) {
        this.initialRowsOrder = this.heatmapData[0].map(function (value, i) {
          return {
            "index": i,
            "value": value.value
          }
        });
      }

      // Saves the initial Columns ordering in initialColsOrder
      if (this.cols && this.cols.length) {
        for (var i = 0; i < this.cols.length; i++) {
          initialColsOrder.push({
            index: i,
            value: Object.keys(this.cols)[i]
          });
        }
        this.initialColsOrder = initialColsOrder;
      }
      // If there's no column header titles uses the first row of data
      else if (this.heatmapData && this.heatmapData.length) {
        this.initialColsOrder = this.heatmapData.map(function (col, i) {
          return {
            "index": i,
            "value": col[0].value
          }
        })
      }
    }
  },

  /**
   * Calculates the RGB color for a value based on the
   * scale settings for the min and max values and the
   * color from and to.
   *
   * @param {number} value The value to calculate the color for.
   * @returns {Array} The RGB colors for the value. [R, G, B]
   *
   * @method _calculateColor
   * @private
   */
  _calculateColor: function(value) {
    var config = this.config;
    return value < config.minValue ? null : value > config.maxValue ? null : config.factors.map(function (x, i) {
      return Math.round(x * (value - config.minValue)) + config.startColor[i];
    })
  },

  /**
   * Observes the changes to config and calculates the
   * RGB start and end colors for the scale and the
   * multiplier factor to calculate the colors for
   * values within the scale.
   * Only if newConfig exists and is different from
   * oldConfig.
   *
   * @param {Object} newConfig The new configuration.
   * @param {Object} oldConfig The old configuration.
   *
   * @method _configChanged
   * @private
   */
  _configChanged: function(newConfig, oldConfig) {
    if(newConfig !== oldConfig && newConfig) {
      var config = this.config;
      if(this.scaleColorFrom) {
        config.startColor = this.scaleColorFrom.replace(/[^\d,]/g, '').split(',').map(function (x) {
          return x / 1;
        });
      }
      if(this.scaleColorTo) {
        config.endColor = this.scaleColorTo.replace(/[^\d,]/g, '').split(',').map(function (x) {
          return x / 1;
        });
      }
      nValues = config.maxValue - config.minValue;
      config.factors = config.endColor.map(function(c,i) {
        return (c - config.startColor[i]) / nValues;
      });
      var data = [].concat(this.data);
      this.set("data", data);
    }
  },

  /**
   * Observes the changes to scale and creates a new
   * config Object with min and max values.
   * Only if newScale exists and is different than
   * oldScale.
   *
   * @param {Array<number>} newScale The new scale limits [min, max].
   * @param {Array<number>} oldScale The old scale limits.
   *
   * @method _scaleChanged
   * @private
   */
  _scaleChanged: function(newScale, oldScale) {
    if(newScale !== oldScale && newScale && newScale.length === 2) {
      var config = this.config;
      config.minValue = newScale[0];
      config.maxValue = newScale[1];
      this.set("config", config);
      this._configChanged(config, {});
    }
  },

  /**
   * Helper method to get headers information
   *
   * @param {string} option The option for the requested information
   * @param {number} index The index of the column/row
   * @returns {string|boolean} Multiple
   *
   * @method _getHeader
   * @private
   */
  _getHeader: function(option, index) {
    if (option === "col") {
      return this.cols[Object.keys(this.cols)[index]];
    }
    else if (option === "row") {
      return this.rows[Object.keys(this.rows)[index]];
    }
    else if (option === "tooltipRow") {
      return Object.keys(this.rows).indexOf(this.rows[Object.keys(this.rows)[index]]) !== -1;
    }
    else if (option === "tooltipCol") {
      return Object.keys(this.cols).indexOf(this.cols[Object.keys(this.cols)[index]]) !== -1;
    }
    else if (option === "fullRow") {
      return Object.keys(this.rows)[index];
    }
    else if (option === "fullCol") {
      return Object.keys(this.cols)[index];
    }
  },

  /**
   * Observes the changes to hideColHeader and hide/show
   * the Column headers based on newValue and applies a css
   * to the scale component and rows container to adjust their
   * size.
   * Only if newValue exists and is different than oldValue.
   * Sets the column header visibility to false if there's no
   * column header titles.
   *
   * @param {boolean} newValue Hide or don't the Column Headers
   * @param {boolean} oldValue The old value.
   *
   * @method _hideColHeaderChanged
   * @private
   */
  _hideColHeaderChanged: function(newValue, oldValue) {
    var rowHeader = Polymer.dom(this.root).querySelector(".table-row-header"),
      scale = Polymer.dom(this.nextElementSibling.root).querySelector(".scale-container"),
      _this = this;
    if (newValue !== undefined && newValue !== oldValue) {
      if (rowHeader) {
        newValue === false ? rowHeader.classList.remove("disable-col-header") : rowHeader.classList.add("disable-col-header");
      }
      if (scale) {
        newValue === false ? scale.classList.remove("disable-col-header") : scale.classList.add("disable-col-header");
      }
    };
    if (newValue !== undefined && newValue === false && newValue !== oldValue && this.cols && (!this.cols.length || !Object.keys(this.cols)[0])) {
      this.hideColHeader = true;
      if (rowHeader) rowHeader.classList.add("disable-col-header");
      if (scale) scale.classList.add("disable-col-header");
    }
    setTimeout(function() {
      _this._resizeColHeaderText();
    });
  },

  /**
   * Sorts the column ascending, descending or resets the sort.
   *
   * @param {event} e The click event on the column header
   *
   * @method _sortCol
   * @private
   */
  _sortCol: function(e) {
    var col = e.model.index,
      // 0 sort ascending, 1 sort descending 2 reset sorting
      order = this.sortColOrder ? this.sortColOrder.index === col ? this.sortColOrder.order === 2 ? 0 : ++this.sortColOrder.order : 0 : 0,
      _this = this,
      temp, newData, rows, newRows, tempRowsReduced;

    this.sortColOrder = {
      "index": col,
      "order": order
    };

    // Sort ascending / descending
    if (order < 2) {
      temp = [];
      for (var i = 0; i < this.heatmapData[col].length; i++) {
        var el = this.heatmapData[col][i];
        temp.push({
          "index": i,
          "value": el ? typeof el.value === "number" ? el.value : -Infinity : -Infinity
        });
      }

      temp.sort(function (a, b) {
        return order ? b.value - a.value : a.value - b.value;
      });
    }
    // Reset sorting
    else {
      temp = [];
      if(this.rows && this.rows.length && Object.keys(this.rows)[0]) {
        this.initialRowsOrder.forEach(function (r) {
          temp.push({
            "index": Object.keys(_this.rows).indexOf(r.value)
          });
        });
      }
      // If there's no row header titles uses the first column of data
      else {
        tempRowsReduced = this.heatmapData[0].map(function (value) {
          return value.value;
        });
        this.initialRowsOrder.forEach(function (r) {
          temp.push({
            "index": tempRowsReduced.indexOf(r.value)
          });
        });
      }
    }

    newData = this.heatmapData.map(function(hd) {
      return temp.map(function(t) {
        return hd[t.index];
      });
    });

    rows = this.rows;
    newRows = [];
    if (rows.length) {
      for (var i = 0; i < temp.length; i++) {
        newRows[Object.keys(rows)[temp[i].index]] = rows[Object.keys(rows)[temp[i].index]];
      }

      // Force set length of array
      newRows.length = Object.keys(newRows).length;
    }

    this.set("heatmapData", []);
    this.set("rows", []);
    this.set("heatmapData", newData);
    this.set("rows", newRows);
  },

  /**
   * Sorts the row ascending, descending or resets the sort.
   *
   * @param {Object} e The click event on the row header
   *
   * @method _sortCol
   * @private
   */
  _sortRow: function(e) {
    var row = e.model.index,
      // 0 sort ascending, 1 sort descending 2 reset sorting
      order = this.sortRowOrder ? this.sortRowOrder.index === row ? this.sortRowOrder.order === 2 ? 0 : ++this.sortRowOrder.order : 0 : 0,
      _this = this,
      temp, hd, newData, cols, newCols, tempColsReduced;

    this.sortRowOrder = {
      "index": row,
      "order": order
    };
    // Sort ascending / descending
    if (order < 2) {
      temp = this.heatmapData.map(function (el, i) {
        return {
          "index": i,
          "value": el[row] ? typeof el[row].value === "number" ? el[row].value : -Infinity : -Infinity
        }
      });
      temp.sort(function (a, b) {
        return order ? b.value - a.value : a.value - b.value;
      });
    }
    // Reset sorting
    else {
      temp = [];
      if (this.cols && this.cols.length && Object.keys(this.cols)[0]) {
        this.initialColsOrder.forEach(function (r) {
          temp.push({
            "index": Object.keys(_this.cols).indexOf(r.value)
          });
        });
      }
      // If there's no column header titles uses the first row of data
      else {
        tempColsReduced = this.heatmapData.map(function (col) {
            return col[0].value;
          });
          this.initialColsOrder.forEach(function (r) {
            temp.push({
              "index": tempColsReduced.indexOf(r.value)
            });
          });
        }
    }

    hd = this.heatmapData;
    newData = temp.map(function(t) {
      return hd[t.index];
    });

    cols = this.cols;
    newCols = [];
    if (cols.length) {
      for (var i = 0; i < temp.length; i++) {
        newCols[Object.keys(cols)[temp[i].index]] = cols[Object.keys(cols)[temp[i].index]];
      }

      //Force set length of Array
      newCols.length = Object.keys(newCols).length;
    }

    this.set("cols", []);
    this.set("heatmapData", []);
    this.set("cols", newCols);
    this.set("heatmapData", newData);
  },

  /**
   * Determines whether to show the sorting icon or not
   *
   * @param {number} i The index of the column/row.
   * @param {string} h col for column or row for row.
   * @param {string} d The direction of the sorting, up or down.
   * @returns {boolean} Show or don't the sorting icon.
   *
   * @method _sortingIcon
   * @private
   */
  _sortingIcon: function(i,h,d) {
    if (this.sortColOrder && h.toLowerCase() === 'col') {
      return this.sortColOrder.index === i ? d.toLowerCase() === 'up' ? this.sortColOrder.order === 0 ? false : true : this.sortColOrder.order === 1 ? false : true : true;
    }
    else if (this.sortRowOrder && h.toLowerCase() === 'row') {
      return this.sortRowOrder.index === i ? d.toLowerCase() === 'up' ? this.sortRowOrder.order === 0 ? false : true : this.sortRowOrder.order === 1 ? false : true : true;
    }
    return true;
  },

  /**
   * Observes the changes to aggregationType and calculates
   * the aggregation of the heatmap data based on the
   * aggregation type and saves the result in the
   * rowAggregation and colAggregation properties.
   * Only if n exists, is different than o data and n is
   * one the following sum, max, min, average, std, count.
   * If n exists and is invalid the aggregation is disabled.
   *
   * @param {string} n The new aggregation type.
   * @param {string} o The old aggregation type.
   *
   * @method _calculateAggregation
   * @private
   */
  _calculateAggregation: function(n, o) {
    if(this.aggregationType && this.aggregationType != null && n && n !== o && this.availableAggregations && this.availableAggregations.indexOf(n.toUpperCase()) !== -1 && this.heatmapData.length > 0) {
      this.set("showAggregation", true);
      var rowAggregation = [],
        colAggregation = [],
        data = this.heatmapData.map(function(hd) {
          return hd.map(function(v) {
            return v.value;
          });
        }),
        // Find max decimal digits for the data in each column
        colDigits = data.map(function(hd) {
          return hd.map(function(a) {
            if (a && typeof a === "number") {
              var temp = (a + "").split(".");
              temp = temp[1] ? temp[1].length : 0;
              return temp;
            }
            return 0;
          }).reduce(function(a, b, i) {
            return i === 0 ? b : a > b ? b : a;
          });
        }),
        // Find the max decimal digits for the data in each row
        rowDigits = data[0].map(function(hd, i) {
          return data.map(function(a) {
            if (a[i] && typeof a[i] === "number") {
              var temp = (a[i] + "").split(".");
              temp = temp[1] ? temp[1].length : 0;
              return temp;
            }
            return 0;
          }).reduce(function(a, b, i) {
            return i === 0 ? b : a > b ? b : a;
          });
        });
      this.set("rowAggregatedData", []);
      this.set("colAggregatedData", []);
      switch (n.toUpperCase()) {
        // Sums the data on each row and each column
        case "SUM":
          rowAggregation = data[0].map(function(c, i) {
            return data.reduce(function(a, b) {
              return a + (b[i] && typeof b[i] === "number" ? b[i] : 0)
            }, 0);
          });
          colAggregation = data.map(function(c) {
            return c.reduce(function(a, b) {
              return a + (b && typeof b === "number" ? b : 0);
            }, 0);
          });
          break;
        // Calculates the average for each row and each column
        case "AVERAGE":
          rowAggregation = data[0].map(function(c,i) {
            return (data.reduce(function(a, b) {
              return a + (b[i] && typeof b[i] === "number" ? b[i] : 0)
            }, 0)) / data.reduce(function(a, b) {
                return a + (b[i] && typeof b[i] === "number" ? 1 : 0);
              }, 0);
          });
          colAggregation = data.map(function(c, i) {
            return c.reduce(function(a, b) {
              return a + (b && typeof b === "number" ? b : 0);
            }, 0) / data[i].reduce(function(a, b) {
                return a + (b && typeof b === "number" ? 1 : 0);
              }, 0);
          });
          break;
        // Calculates the standard deviation for each row and each column
        case "STD":
          rowAggregation = data[0].map(function(c,i) {
            return (data.reduce(function(a, b) {
                return a + (b[i] && typeof b[i] === "number" ? b[i] : 0)
              }, 0)) / data.reduce(function(a, b) {
                return a + (b[i] && typeof b[i] === "number" ? 1 : 0);
              }, 0);
          });
          rowAggregation = data[0].map(function (c, i) {
            return Math.sqrt((data.reduce(function (a,b) {
              return a + (b[i] && typeof b[i] === "number" ? Math.pow((b[i] - rowAggregation[i]), 2) : 0);
            }, 0)) / data.reduce(function (a, b) {
                return a + (b[i] && typeof b[i] === "number" ? 1 : 0);
              }, 0));
          });
          colAggregation = data.map(function(c, i) {
            return c.reduce(function(a, b) {
                return a + (b && typeof b === "number" ? b : 0);
              }, 0) / data[i].reduce(function(a, b) {
                return a + (b && typeof b === "number" ? 1 : 0);
              }, 0);
          });
          colAggregation = data.map(function (c, i) {
            return Math.sqrt((c.reduce(function (a, b) {
              return a + (b && typeof b === "number" ? Math.pow((b - colAggregation[i]), 2) : 0);
            }, 0)) / data[i].reduce(function (a, b) {
                return a + (b && typeof b === "number" ? 1 : 0);
              }, 0));
          });
          break;
        // Finds the max value on each row and each column
        case "MAX":
          rowAggregation = data[0].map(function(c, i) {
            return data.reduce(function(a, b) {
              return typeof b[i] === "number" ? a > b[i] ? a : b[i] : a;
            }, -Infinity);
          });
          colAggregation = data.map(function(c) {
            return c.reduce(function(a, b) {
              return typeof b === "number" ? a > b ? a : b : a;
            }, -Infinity);
          });
          break;
        // Finds the min value on each row and each column
        case "MIN":
          rowAggregation = data[0].map(function(c, i) {
            return data.reduce(function(a, b) {
              return typeof b[i] === "number" ? a < b[i] ? a : b[i] : a;
            }, Infinity);
          });
          colAggregation = data.map(function(c) {
            return c.reduce(function (a, b) {
              return typeof b === "number" ? a < b ? a : b : a;
            }, Infinity);
          });
          break;
        // Count how many valid values (numbers) on each row and each column
        default: //COUNT
          rowAggregation = data[0].map(function (c, i) {
            return data.reduce(function (a, b) {
              return a + (b[i] && typeof b[i] === "number" ? 1 : 0);
            }, 0);
          });
          colAggregation = data.map(function (c, i) {
            return data[i].reduce(function (a, b) {
              return a + (b && typeof b === "number" ? 1 : 0);
            }, 0);
          });
      }

      colAggregation = colAggregation.map(function (v, i) {
        return (v + "").substr(0, (v + "").split(".")[0].length + 2 + colDigits[i]);
      });
      rowAggregation = rowAggregation.map(function (v, i) {
        return (v + "").substr(0, (v + "").split(".")[0].length + 2 + rowDigits[i]);
      });
      this.set("rowAggregatedData", rowAggregation);
      this.set("colAggregatedData", colAggregation);
    }
    // If n is invalid, disables the aggregation
    else if(this.aggregationType && o && n && o !== n && this.availableAggregations.indexOf(n.toUpperCase()) === -1) {
      this.set("aggregationType", "");
      this.set("showAggregation", false);
    }
  },

  /**
   * Gets the aggregation value for the specified column.
   *
   * @param {number} i The column index.
   * @returns {string} The value as a string or an empty string.
   *
   * @method _getColAggregation
   * @private
   */
  _getColAggregation: function(i) {
    return this.colAggregatedData ? this.colAggregatedData[i] : '';
  },

  /**
   * Observes the changes to scaleColorFrom and triggers
   * _configChanged if newColor exists and is different
   * than oldColor.
   *
   * @param {string} newColor The new color.
   * @param {string} oldColor The old color.
   *
   * @method _scaleColorFromChanged
   * @private
   */
  _scaleColorFromChanged: function(newColor, oldColor) {
    if (newColor && newColor !== oldColor) {
      this._configChanged(this.config, {});
    }
  },

  /**
   * Observes the changes to scaleColorTo and triggers
   * _scaleColorToChanged if newColor exists and is
   * different than oldColor.
   *
   * @param {string} newColor The new color.
   * @param {string} oldColor The old color.
   *
   * @method _scaleColorToChanged
   * @private
   */
  _scaleColorToChanged: function(newColor, oldColor) {
    if (newColor && newColor !== oldColor) {
      this._configChanged(this.config, {});
    }
  },

  /**
   * Observes the changes to hideRowHeader and sets
   * the row header visibility to false when
   * there' no header titles.
   *
   * @param {boolean} nHide Hide or show the header titles.
   * @param {boolean} oHide The old value.
   *
   * @method _hideRowHeaderChanged
   * @private
   */
  _hideRowHeaderChanged: function(nHide, oHide) {
    var _this = this;
    if (nHide !== undefined && nHide === false && nHide !== oHide && this.rows && (!this.rows.length || !Object.keys(this.rows)[0])) {
      this.hideRowHeader = true;
    }
    else if(!nHide && oHide) {
      this.hideRowHeader = false;
    }
    setTimeout(function() {
      _this._resizeRowHeaderText();
    });
  },

  /**
   * Observes the changes to showAggregation and triggers
   * the aggregation calculation for rows.
   * Trigger the aggregation calculation for the columns
   * only when there're column header titles.
   *
   * @param {string} nShow The aggregation type to show.
   * @param {string} oShow The aggregation type shown before.
   * @private
   */
  _showAggregationChanged: function(nShow, oShow) {
    if (nShow !== undefined && nShow != oShow) {
      this.set('showRowAggregation', nShow);
      this.set('showColAggregation', false);
      if (this.heatmapData[0] && this.heatmapData[0].length > 1) {
        this.set('showColAggregation', nShow);
      }
    }
  },

  /**
   * Observes the changes to heatmapData and triggers
   * the resize helper methods.
   *
   * @param {object} newData The new heatmap data
   * @param {object} oldData The old heatmap data
   * @private
   */
  _heatmapDataChanged: function(newData, oldData) {
    var _this = this;
    setTimeout(function() {
      _this._resizeRowHeaderText();
      _this._resizeColHeaderText();
    });
  },

  /**
   * Helper method to resize the Row header based on
   * the available space (width) for rendering the text.
   *
   * @private
   */
  _resizeRowHeaderText: function() {
    var _this = this,
      headers = Polymer.dom(this.root).querySelectorAll(".row-header-text"),
      rowMaxWidth = this.rowMaxWidth,
      rows, spanEl, initialText, finalText;

    if (rowMaxWidth !== "none") {
      rowMaxWidth = Number(rowMaxWidth.split('px')[0]) - 30;

      if (headers && headers.length) {
        headers.forEach(function (headerEl) {
          headerEl.style.width = rowMaxWidth + 'px';
          spanEl = headerEl.children[0];
          initialText = spanEl.innerText;
          finalText = _this._resizeHelper(headerEl, spanEl);
          if (finalText) {
            _this.rows[initialText] = finalText;
          }
        });

        // Force notify Polymer that rows object changed
        rows = this.rows;
        this.set('rows', []);
        this.set('rows', rows);
      }
    }
  },

  /**
   * Helper method to resize the Column header based on
   * the available space (width) for rendering the text.
   *
   * @private
   */
  _resizeColHeaderText: function() {
    var _this = this,
      headers = Polymer.dom(this.root).querySelectorAll(".col-header-text"),
      cellMaxWidth = this.cellMaxWidth,
      cols, spanEl, initialText, finalText;

    if (cellMaxWidth !== "none") {
      cellMaxWidth = Number(cellMaxWidth.split('px')[0]) - 30;

      if (headers && headers.length) {
        headers.forEach(function (headerEl) {
          headerEl.style.width = cellMaxWidth + 'px';
          spanEl = headerEl.children[0];
          initialText = spanEl.innerText;
          finalText = _this._resizeHelper(headerEl, spanEl);
          if (finalText) {
            _this.cols[initialText] = finalText;
          }
        });

        // Force notify Polymer that cols object changed
        cols = this.cols;
        this.set('cols', []);
        this.set('cols', cols);
      }
    }
  },

  /**
   * Helper method to reduce the innerText of the child element
   * based on the width of the parent element, adding ellipses
   * to the end of the text.
   *
   * @method _resizeHelper
   * @private
   *
   * @param {HTMLElement} parent The parent Element
   * @param {HTMLElement} child The child Element
   *
   * @returns {string|null} The reduced text if the child was
   * bigger than parent, or null if the child was
   * smaller than parent.
   */
  _resizeHelper: function(parent, child) {
    var childWidth = window.getComputedStyle(child).width.replace('px', '') / 1,
      parentWidth = window.getComputedStyle(parent).width.replace('px', '') / 1,
      changed = false;

    while (childWidth > parentWidth) {

      if (child.innerText.substr(child.innerText.length - 3, child.innerText.length) !== '...') {
        child.innerText += '...';
      }
      child.innerText = child.innerText.substr(0, child.innerText.length - 4) + '...';
      childWidth = window.getComputedStyle(child).width.replace('px', '') / 1;
      parentWidth = window.getComputedStyle(parent).width.replace('px', '') / 1;
      changed = true;
    }

    return changed ? child.innerText : null;
  }
});
