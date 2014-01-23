/**
 * @fileoverview MegaSeries is an interactive time series plug-in to visualizes
 * large time series.
 *
 * Current features:
 *  - Visualizing one or more Series with large data size (>2000 data points)
 *  - Interactive context panel to keep track of which part of the series is
 *    selected.
 *  - Mouse scroll wheel resizes the series.
 *  - Y values for each series is shown on the upper right after on mouse over.
 *  - Automatic color choice from Protvis color bands.
 *  - Interface to add and delete series one by one after initial creation.
 *  - Support for onmousemove handler (slightly unfinished)
 *
 * TODO(akiani)
 * Under development:
 *  - Adding handlers and interface to query the data based on x value.
 *  - Adding Formatters for ticks
 *  - Adding annotations visualization
 *  - Adding more configurable properties for appearance
 *  - Working on performance on Firefox
 *  - Adding configurable series specific options.
 *
 * Remarks:
 *   The time series is drawn using Protovis (http://vis.stanford.edu/protovis),
 *   which uses SVG for rendering. The code below assumes that Protovis v3.2+
 *   is already loaded prior to calling MegaSeries.draw(). For google3 code,
 *   you can use the version in third_party/javascript/protovis.
 *
 *
 * @author akiani (Amirhossein Kiani)
 */

/**
 * Constructs a new MegaSeries to be rendered inside the given container.
 *
 * @param {Element}
 *            container The HTML container to draw in.
 * @constructor
 */
MegaSeries = function(container) {
    this.container_ = container;
    this.series = [];
};

/**
 * Draws a new {@link MegaSeries} in the specified container, based on the given
 * config object.
 *
 * @param {Object}
 *            config a dictionary containing the {@link Series} array to be
 *            visualized and configuration for this {@link MegaSeries}.
 *
 * Current entries in the config object include: Series - an array of
 * {@link Series} objects to be visualized. Each Series' options can be
 * specified as explained inside the object.
 */
MegaSeries.prototype.draw = function(config) {
    // TODO(akiani): add error checking for data
    config = this.setDefaults_(config);
    if (this.series.length == 1) {
        this.config_ = this.configure_(config);
    }
    this.drawVisualization_(this.config_);
};

/**
 * Finds the missing config entries, if any, and, sets them to their default
 * values.
 *
 * @param {Object}
 *            config MegaSeries config dictionary.
 *
 * @return {Object} Config with defaults added if they were missing.
 *
 * @private
 */
MegaSeries.prototype.setDefaults_ = function(config) {
    // Default values for config.
    // TODO(akiani): extract more config parameters to make more features
    // configurable.

    config = config || {};

    config.width = config.width || 1024;
    config.contextPanelHeight = config.contextPanelHeight || 50;
    config.focusPanelHeight = config.focusPanelHeight || 500;

    config.colors = config.colors || {};

    // Default colors.
    var colors = config.colors;
    var defaultColors = MegaSeries.DEFAULT_COLORS_;
    colors.xTickRulers =
      colors.xTickRulers || defaultColors.X_TICK_RULERS_COLOR;
    colors.yTickRulers =
      colors.yTickRulers || defaultColors.Y_TICK_RULERS_COLOR;
    colors.focusSelectBox =
      colors.focusSelectBox || defaultColors.FOCUS_SELECTBOX_COLOR;
    colors.contextSelectBox =
      colors.contextSelectBox || defaultColors.CONTEXT_SELECTBOX_COLOR;
    return config;
};

/**
 * Performs initial configuration needed before draw() and writes the values
 * calculated to the config object (shared between the calls)
 *
 * TODO(akiani): add a Formatter for x and y values
 *
 * @private
 * @param {Object}
 *            config MegaSeries config dictionary.
 * @return {Object} config object with initial configuration applied.
 */
MegaSeries.prototype.configure_ = function(config) {
    // calculate bounds for start,end,lowest and highest by going through each
    // series
    var series = this.series;
    var firstSeries = series[0].getXYData();
    var start = firstSeries[0].x;
    var end = firstSeries[firstSeries.length - 1].x;
    var minY = 0;
    var maxY = parseInt(firstSeries[firstSeries.length - 1].y);
    for (var i = 0; i < series.length; i++) {
        var tempSeries = series[i].getXYData();
        var tempSeriesMaxY = pv.max(tempSeries, function(d) {
            return d.y;
        });
        var tempSeriesMinY = pv.min(tempSeries, function(d) {
            return d.y;
        });
        if (maxY < tempSeriesMaxY) {
            maxY = tempSeriesMaxY;
        }
        if (minY > tempSeriesMinY) {
            minY = tempSeriesMinY;
        }
        if (start > tempSeries[0].x) {
            start = tempSeries[0].x;
        }
        if (end < tempSeries[tempSeries.length - 1].x) {
            end = tempSeries[tempSeries.length - 1].x;
        }
    }

    config.series = series;
    config.end = end;
    config.start = start;
    config.maxY = maxY;
    config.minY = minY;

    // Create x and y transformations for the context panel based on the
    // input data.

    config.x = pv.Scale.linear(config.start, config.end).range(0,
                    config.width), config.y = pv.Scale.linear(minY, maxY)
                    .range(0, config.contextPanelHeight);
    config.y2 = pv.Scale.linear(minY, maxY).range(0, config.focusPanelHeight);

    if(this.series.length == 1) {
      // Interaction state dictionary.
      // Should not be reinitialized after the first series.
      // to keep the same view as more series are added
      config.i = {
          x: 824,
          dx: 200
      };
    }

    // Focus panel x and y transformations (domain is set on-render)
    config.fx = pv.Scale.linear().range(0, config.width);
    config.fy = pv.Scale.linear([0, config.maxY]).range(0,
            config.focusPanelHeight);

    return config;
};

/**
 * Can be called to add a single {@link Series} to the panel. A subsequent call
 * to the .draw() function is required to render the series thereafter.
 *
 * @param {Series}
 *            series object to be added to the Mega Series.
 */
MegaSeries.prototype.addSingleSeries = function(series) {
    this.series.push(series);
};

/**
 * Constructs a Series object from the passed parameters and adds it to the
 * MegaSeries. A subsequent call to the .draw() function is required to render
 * the series thereafter.
 *
 * @param {String}
 *            name String representation for the name of the {@link Series}.
 * @param {Object}
 *            xydata a list of dictionaries for xy position of data.
 * @param {Object}
 *            annotations a list of dictionaries for annotations text and
 *            location.
 * @param {Object}
 *            options a dictionary of options for this specific {@link Series}.
 */
MegaSeries.prototype.addSeries = function(name, xydata, annotations, options) {
    if (this.series.length == 10 && options.strokeColor == undefined) {
        alert('Can\'t add more than 10 series with the current color scheme.');
        return;
    }
    var series = new Series(name, xydata, annotations, options);
    this.addSingleSeries(series);
};

/**
 * Removes the {@link Series} that matches the name of the passed Series from
 * this {@link MegaSeries}. A subsequent call to the .draw() function is
 * required to render the widget without this Series thereafter.
 *
 * @param {String}
 *            name The name associated with this Series upon creation.
 */
MegaSeries.prototype.removeSeries = function(name) {
    var size = this.series.length;
    for (var i = 0; i < size; i++) {
        if (this.series[i].name == name) {
            this.series.splice(i, 1);
        }
    }
};

/**
 * The default colors used by the MegaSeries.
 *
 * @enum {string}
 * @private
 */
MegaSeries.DEFAULT_COLORS_ = {
    X_TICK_RULERS_COLOR: '#eee',
    Y_TICK_RULERS_COLOR: '#aaa',
    FOCUS_SELECTBOX_COLOR: 'rgba(128, 128, 128, .2)',
    CONTEXT_SELECTBOX_COLOR: 'rgba(128, 128, 128, .2)'
};

/**
 * Renders the MegaSeries using Protovis Visualization Library from Stanford
 * Visualization Group (which uses SVG internally).
 *
 * @param {!Object}
 *            config The visualization configuration.
 *
 * @see http://vis.stanford.edu/protovis
 * @private
 */
MegaSeries.prototype.drawVisualization_ = function(config) {
    // Root panel.
    var vis = new pv.Panel()
        .canvas(this.container_)
        .width(config.width)
        .height(config.focusPanelHeight + 20 + config.contextPanelHeight)
        .bottom(20)
        .left(100)
        .right(20)
        .top(5);

    // Focus panel (zoomed in).
    var focus = vis.add(pv.Panel)
        .top(0)
        .height(config.focusPanelHeight);

    this.transformSeries_(config, this.series[0].getXYData());

    // X-axis tick rulers.
    focus.add(pv.Rule)
        .data(function() {
            return config.fx.ticks();
        })
        .left(config.fx)
        .strokeStyle(config.colors.xTickRulers)
        .anchor('bottom')
        .add(pv.Label)
            .text(config.fx.tickFormat);

    // Y-axis ticks.
    focus.add(pv.Rule)
        .data(function() {
            return config.fy.ticks(7);
        })
        .bottom(config.fy)
        .strokeStyle(config.colors.yTickRulers)
        .anchor('left')
        .add(pv.Label)
        .text(config.fy.tickFormat);

    // assigning a variable to the private function because the scope
    // is lost inside the Protovis call. Could probably be done using Closure or
    // jQuery but seemed to be an easy option to keep the library independent.
    var transformFunction = this.transformSeries_;

    // flags to separate mousemove behavior and mouseclick/select behavior
    var isMouseOver = false;
    var isMouseClick = false;

    // Focus area chart. One panel is created per series
    var panel = focus.add(pv.Panel)
        .data(this.series)
        .overflow('hidden')
        .cursor('crosshair');
    panel.add(pv.Area)
        .data(function(d) {
            return transformFunction(config, d.getXYData());
        })
        .left(function(d) {
            return config.fx(d.x);
        })
        .bottom(1)
        .height(function(d) {
            return config.fy(d.y);
        })
        .fillStyle(function() {
            var color = pv.Colors.category10().range()[this.parent.index];
            color.opacity = .1;
            return color;
        })
        .anchor('top')
    // the stroke on top of area chart
    .add(pv.Line)
        .fillStyle(null)
        .strokeStyle(function() {
            return pv.Colors.category10().range()[this.parent.index];
        })
        .lineWidth(1)
    // moving dot on top of each series
    .add(pv.Dot)
        .visible(function() {
            return config.p >= 0;
        })
        .data(function(d) {
            if (config.p >= 0) {
                return [config.dd[config.p]];
            } else {
                return [];
            }
        })
        .left(function(d) {
            if (d)
                return config.fx(d.x);
        })
        .bottom(function(d) {
            if (d)
                return config.fy(d.y);
        })
        .fillStyle(function() {
            return pv.Colors.category10().range()[this.parent.index];
        })
        .size(10)
        .lineWidth(1)
    // legend on the upper left side
    .add(pv.Dot)
        .fillStyle(function() {
            return pv.Colors.category10().range()[this.parent.index];
        })
        .left(5)
        .top(function() {
            return this.parent.index * 12 + 10;
        })
        .anchor('right')
        .add(pv.Label)
        .text(function(d) {
            if (d) {
                return parseInt(d.y).toFixed(2);
            }
        });

    // dictionary to contain zoomarea
    var zoomarea = {
        x: 0,
        dx: 0
    };

    // function to be called after selection is done on the focus panel to
    // slice the data and update the size of the selection in on the context
    // panel.
    var zoom = function() {
        var transform = pv.Scale.linear(0, config.width).range(
                config.zoomstart, config.zoomend);
        var d1 = transform(zoomarea.x), d2 =
          transform(zoomarea.x + zoomarea.dx);
        var end = zoomarea.x + zoomarea.dx;
        var width = d2 - d1;
        config.i.x = d1;
        config.i.dx = width;
    };

    // function that handles zooming using mouse gestures (scroll wheel)
    var mouseZoom = function() {
        var t = this.transform();
        var scaleFactor = 1 + ((t.k - 1.) * 100);

        if ((config.i.x + scaleFactor * config.i.dx) < config.width) {
            if (t.k * scaleFactor * (config.i.dx) > 1) {
                config.i.dx = config.i.dx * scaleFactor;
            } else {
                config.i.dx = 1;
            }
        } else {
            config.i.dx = config.width - config.i.x;
        }
        t.k = 1;
        return vis;
    };

    var updateBar = function() {
        vis.render();
    };

    // add handlers on the focus panel to perform select and zoom and mouse
    // scaling feature.
    // legend is also populated here (see mousemove event)
    var focusZoom = focus.add(pv.Panel)
            .cursor('crosshair')
            .data([zoomarea])
            .events('all')
            .event('selectstart', function() {
                isMouseClick = true;
                return focusBar.width(function(d) {
                    return d.dx;
                });
            })
            .event('mousedown', pv.Behavior.select())
            .event('select', zoom)
            .event('selectend', function() {
                isMouseClick = false;
                return focusBar.width(0);
            })
            .event('mouseup', updateBar)
            .event('mousewheel', pv.Behavior.zoom())
            .event('zoom', mouseZoom)
            .event('zoomend', updateBar)
            .event('mouseout', function() {
                config.p = -1;
                return vis;
            })
            .event('mousemove', function() {
                if (!isMouseClick) {
                    var mx = config.fx.invert(vis.mouse().x);
                    config.p = pv.search(config.dd.map(function(d) {
                        return d.x;
                    }), mx);
                    config.p = config.p < 0 ? (-config.p - 2) : config.p;
                    // run handler
                    if (config.mouseMoveHandler) {
                        config.mouseMoveHandler();
                    }
                    return focus;
                }
            });

    var focusBar = focusZoom.add(pv.Bar)
      .left(function(d) {
          return d.x;
      })
      .width(function(d) {
          return d.dx;
      })
      .fillStyle(config.colors.focusSelectBox);

    // Context panel (zoomed out).
    var contextRoot = vis.add(pv.Panel)
       .bottom(0)
       .height(config.contextPanelHeight);

    // Context panel (zoomed out).
    var context = contextRoot.add(pv.Panel)
      .data(this.series);

    // X-axis ticks.
    contextRoot.add(pv.Rule)
      .data(config.x.ticks())
      .left(config.x)
      .strokeStyle(config.colors.xTickRulers)
      .anchor('bottom')
      .add(pv.Label)
      .text(config.x.tickFormat);

    // Y-axis ticks.
    contextRoot.add(pv.Rule)
      .bottom(0);

    // pointer to the selected point on the canvas
    config.p = -1;

    // Context area chart.
    context.add(pv.Area)
      .data(function(d) {
          return d.getXYData();
      })
      .left(function(d) {
          return config.x(d.x);
      })
      .bottom(1)
      .height(function(d) {
          return config.y(d.y);
      })
      .fillStyle(function() {
          var color = pv.Colors.category10().range()[this.parent.index];
          color.opacity = .1;
          return color;
      })
      .overflow('hidden')
       .anchor('top')
       .add(pv.Line)
       .strokeStyle(function() {
         return pv.Colors.category10().range()[this.parent.index];
       })
       .lineWidth(1);

    // The selectable, draggable focus region.
    var footerfocus = contextRoot.add(pv.Panel)
      .data([config.i])
      .cursor('crosshair')
      .events('all')
      .event('mousedown', pv.Behavior.select())
      .event('selectend', focus);

    footerfocus.add(pv.Bar)
      .left(function(d) {
          return d.x;
      })
      .width(function(d) {
          return d.dx;
      })
      .fillStyle(config.colors.contextSelectBox)
      .cursor('move')
      .event('mousedown', pv.Behavior.drag())
      .event('dragend', focus);

    // finally, render the entire widget.
    vis.render();
};

/**
 * Transforms location on the canvas to an interval in each Series and returns
 * that part of the Series.
 *
 * @param {Object} 
 *            config Config object that keeps track of state.
 * @param {Series}
 *            series Series object to be transformed.
 * @return {Object} list of xy values corresponding to the output of the
 *            transformation.
 * @private
 */
MegaSeries.prototype.transformSeries_ = function(config, series) {
    var d1 = config.x.invert(config.i.x),
        d2 = config.x.invert(config.i.x + config.i.dx),
        dd = series.slice(Math.max(0, pv.search.index(series, d1, function(d) {
                return d.x;
            }) - 1), pv.search.index(series, d2, function(d) {
        return d.x;
    }) + 1);
    config.fx.domain(d1, d2);
    config.zoomstart = config.i.x;
    config.zoomend = config.i.x + config.i.dx;
    config.dd = dd;
    return dd;
};

/**
 * Constructor for the {@link Series} object. A Series is a data structure that
 * represents a Series in a MegaSeries. Each Series appearance can be controlled
 * by setting its options by passing a dictionary of options here or by calling
 * .setOption(options) on the series after it is created.
 *
 * @param {String}
 *            name the String name for this series.
 * @param {Object}
 *            xydict a list of dictionaries in the form of {x: NUMBER, y:
 *            NUMBER} <b>sorted</b> in X order.
 * @param {Object}
 *            annotations dictionary containing {x: , title: , description: , }.
 * @param {Object}
 *            options a dictionary containing the options for this Series.
 * @constructor
 */
Series = function(name, xydict, annotations, options) {
    this.name = name;
    this.setXYData(xydict);
    this.setAnnotations(annotations);
    this.setOptions(options);
};

/**
 * Adds an annotations dictionary to this Series by looking up the Y values for
 * the annotations. The Y value lookup is currently on an exact match basis,
 * therefore one needs to make sure that the specified x values for the
 * annotations actually corresponts to a Y value in the xy values for the
 * Sereis.
 *
 * @param {Object}
 *            annotations dictionary containing {x: , title: , description: , }.
 */
Series.prototype.setAnnotations = function(annotations) {
    xydata = this.getXYData();
    // fill up the y value for annotations.
    if (annotations != undefined) {
        if (xydata) {
            var size = annotations.length;
            for (var i = 0; i < size; i++) {
                // binary search in sorted array - O(log(n))
                var index = pv.search.index(xydata, annotations[i].x, function(
                        d) {
                    return d.x;
                });
                annotations[i].y = xydata[index].y;
            }
        } else {
            throw ('XY data has to be set before annotations.');
        }
        this.annotations = annotations;
    }
};

/**
 * Returns the annotations object for this Series.
 *
 * @return {Objecy} dictionary containing annotations.
 */
Series.prototype.getAnnotations = function() {
    return this.annotations;
};

/**
 * Sets the XY data for this Series.
 *
 * @param {Object} xydict
 *            a list of dictionaries in the form of {x: NUMBER, y: NUMBER}
 *            <b>sorted</b> in X order.
 */
Series.prototype.setXYData = function(xydict) {
    this.xydict = xydict;
};

/**
 * Returns the XY data for this Series.
 *
 * @return {List} a list of dictionaries in the form of {x: NUMBER, y: NUMBER}.
 */
Series.prototype.getXYData = function() {
    return this.xydict;
};

/**
 * Sets options dictionary for this specific Series.
 *
 * TODO(akiani): expand the list of possible options to give more granular
 * control over each series appearance.
 *
 * @param {Object} options options dictionary to be set on the series.
 */
Series.prototype.setOptions = function(options) {
    if (options != undefined) {
        this.strokeColor = options.strokeColor || '#000';
        this.fillColor = options.fillColor || '#000';
        this.errorBand = options.errorBand || '#000';
    }
};
