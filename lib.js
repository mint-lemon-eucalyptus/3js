var Lib = {

    namespace: function (namespace, obj) {

        var parts = namespace.split('.');

        var parent = Lib;

        for (var i = 1, length = parts.length; i < length; i++) {
            var currentPart = parts[i];
            parent[currentPart] = parent[currentPart] || {};
            parent = parent[currentPart];
        }
        return parent;
    },

    keys: function (obj) {
        var keys = [];
        for (var key in obj) keys.push(key);
        return keys;
    },

    extend: function (destination, source) {

        for (var property in source) {
            destination[property] = source[property];
        }
        return destination;
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Lib;
}


(function (globalContext) {
    var _toString = Object.prototype.toString,
        FUNCTION_CLASS = '[object Function]';

    function isFunction(object) {
        return _toString.call(object) === FUNCTION_CLASS;
    }

    function extend(destination, source) {
        for (var property in source) if (source[property]) // modify protect primitive slaughter
            destination[property] = source[property];
        return destination;
    }

    function keys(object) {
        var results = [];
        for (var property in object) {
            if (object[property]) {
                results.push(property);
            }
        }
        return results;
    }

    var slice = Array.prototype.slice;

    function argumentNames(fn) {
        var names = fn.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
            .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
            .replace(/\s+/g, '').split(',');
        return names.length == 1 && !names[0] ? [] : names;
    }

    function wrap(fn, wrapper) {
        var __method = fn;
        return function () {
            var a = update([bind(__method, this)], arguments);
            return wrapper.apply(this, a);
        }
    }

    function update(array, args) {
        var arrayLength = array.length, length = args.length;
        while (length--) array[arrayLength + length] = args[length];
        return array;
    }

    function merge(array, args) {
        array = slice.call(array, 0);
        return update(array, args);
    }

    function bind(fn, context) {
        if (arguments.length < 2) return this;
        var __method = fn, args = slice.call(arguments, 2);
        return function () {
            var a = merge(args, arguments);
            return __method.apply(context, a);
        }
    }

    var Class = (function () {

        function subclass() {
        };
        function create() {
            var parent = null, properties = [].slice.apply(arguments);
            if (isFunction(properties[0]))
                parent = properties.shift();

            function klass() {
                this.initialize.apply(this, arguments);
            }

            extend(klass, Class.Methods);
            klass.superclass = parent;
            klass.subclasses = [];

            if (parent) {
                subclass.prototype = parent.prototype;
                klass.prototype = new subclass;
                try {
                    parent.subclasses.push(klass)
                } catch (e) {
                }
            }

            for (var i = 0, length = properties.length; i < length; i++)
                klass.addMethods(properties[i]);

            klass.prototype.constructor = klass;
            return klass;
        }

        function addMethods(source) {
            var ancestor = this.superclass && this.superclass.prototype,
                properties = keys(source);

            for (var i = 0, length = properties.length; i < length; i++) {
                var property = properties[i], value = source[property];
                if (ancestor && isFunction(value) &&
                    argumentNames(value)[0] == "$super") {
                    var method = value;
                    value = wrap((function (m) {
                        return function () {
                            return ancestor[m].apply(this, arguments);
                        };
                    })(property), method);

                    value.valueOf = bind(method.valueOf, method);
                    value.toString = bind(method.toString, method);
                }
                this.prototype[property] = value;
            }

            return this;
        }

        return {
            create: create,
            Methods: {
                addMethods: addMethods
            }
        };
    })();

    if (globalContext.exports) {
        globalContext.exports.Class = Class;
    }
    else {
        globalContext.Class = Class;
    }
})(Lib);

Lib.namespace('Lib.Chart');

Lib.Chart = function (args) {

    this.element = args.element;
    this.series = args.chartData;

    this.defaults = {
        interpolation: 'cardinal',
        offset: 'zero',
        min: undefined,
        max: undefined,
        preserve: false
    };

    Lib.keys(this.defaults).forEach(function (k) {
        this[k] = args[k] || this.defaults[k];
    }, this);

    this.window = {};

    var self = this;

    this.initialize = function (args) {

        this.series.active = function () {
//            console.log(self.series)
            return self.series.series;
        };

        this.setSize({ width: args.width, height: args.height });

        args.element.classList.add('chart_graph');
        this.vis = d3.select(args.element).append("svg:svg").attr('width', this.width).attr('height', this.height);


        for (var name in Lib.Chart.Renderer) {
            var r = Lib.Chart.Renderer[name];
            if (!r || !r.prototype || !r.prototype.render) continue;
            self.registerRenderer(new r({ graph: self }));
        }


        this.setRenderer(args.renderer, args);
        this.discoverRange();
    };


    this.discoverRange = function () {

        var domain = this.renderer.domain();

        this.x = d3.scale.linear().domain(domain.x).range([0, this.width]);

        this.y = d3.scale.linear().domain(domain.y).range([this.height, 0]);

        this.y.magnitude = d3.scale.linear()
            .domain([domain.y[0] - domain.y[0], domain.y[1] - domain.y[0]])
            .range([0, this.height]);
    };

    this.render = function () {

        this.discoverRange();

        this.renderer.render();

    };

    this.update = this.render;

    this.stackData = function () {

        var data = this.series.active()
            .map(function (d) {
                return d.data
            })
            .map(function (d) {
                return d.filter(function (d) {
                    return this._slice(d)
                }, this)
            }, this);

        this.series.active().forEach(function (series, index) {
            if (series.scale) {
                // apply scale to each series
                var seriesData = data[index];
                if (seriesData) {
                    seriesData.forEach(function (d) {
                        d.y = series.scale(d.y);
                    });
                }
            }
        });

        this.stackData.hooks.data.forEach(function (entry) {
            data = entry.f.apply(self, [data]);
        });
        var stackedData;
        this.stackData.hooks.after.forEach(function (entry) {
            stackedData = entry.f.apply(self, [data]);
        });

        var i = 0;
        this.series.series.forEach(function (series) {
            series.stack = stackedData[i++];
        });

        this.stackedData = stackedData;
        return stackedData;
    };

    this.stackData.hooks = { data: [], after: [] };

    this._slice = function (d) {

        if (this.window.xMin || this.window.xMax) {

            var isInRange = true;

            if (this.window.xMin && d.x < this.window.xMin) isInRange = false;
            if (this.window.xMax && d.x > this.window.xMax) isInRange = false;

            return isInRange;
        }

        return true;
    };


    this.registerRenderer = function (renderer) {
        this._renderers = this._renderers || {};
        this._renderers[renderer.name] = renderer;
    };

    this.configure = function (args) {
        if (args.width || args.height) {
            this.setSize(args);
        }
    };

    this.setRenderer = function (r, args) {
        this.renderer = this._renderers[r];
        this.renderer.configure(args);
    };

    this.setSize = function (args_) {
        var style = window.getComputedStyle(this.element, null);
        var elementWidth = parseInt(style.getPropertyValue('width'), 10);
        var elementHeight = parseInt(style.getPropertyValue('height'), 10);
        this.width = args_.width || elementWidth || 400;
        this.height = args_.height || elementHeight || 250;
        this.vis && this.vis.attr('width', this.width).attr('height', this.height);
    };

    this.initialize(args);
};
Lib.namespace('Lib.TriAngChart');
Lib.TriAngChart = function (args) {

    this.element = args.element;
    this.series = args.chartData;

    this.defaults = {
        interpolation: 'cardinal',
        offset: 'zero',
        min: undefined,
        max: undefined,
        preserve: false
    };

    Lib.keys(this.defaults).forEach(function (k) {
        this[k] = args[k] || this.defaults[k];
    }, this);

    this.window = {};

    var self = this;

    this.initialize = function (args) {

        this.series.active = function () {
//            console.log(self.series)
            return self.series.series;
        };

        this.setSize({ width: args.width, height: args.height });

        args.element.classList.add('chart_graph');
        this.vis = d3.select(args.element).append("svg:svg").attr('width', this.width).attr('height', this.height);


        for (var name in Lib.Chart.Renderer) {
            var r = Lib.Chart.Renderer[name];
            if (!r || !r.prototype || !r.prototype.render) continue;
            self.registerRenderer(new r({ graph: self }));
        }


        this.setRenderer(args.renderer, args);
        this.discoverRange();
    };


    this.discoverRange = function () {

        var domain = this.renderer.domain();

        this.x = d3.scale.linear().domain(domain.x).range([0, this.width]);

        this.y = d3.scale.linear().domain(domain.y).range([this.height, 0]);

        this.y.magnitude = d3.scale.linear()
            .domain([domain.y[0] - domain.y[0], domain.y[1] - domain.y[0]])
            .range([0, this.height]);
    };

    this.render = function () {

        this.discoverRange();

        this.renderer.render();

    };

    this.update = this.render;

    this.stackData = function () {

        var data = this.series.active()
            .map(function (d) {
                return d.data
            })
            .map(function (d) {
                return d.filter(function (d) {
                    return this._slice(d)
                }, this)
            }, this);

        this.series.active().forEach(function (series, index) {
            if (series.scale) {
                // apply scale to each series
                var seriesData = data[index];
                if (seriesData) {
                    seriesData.forEach(function (d) {
                        d.y = series.scale(d.y);
                    });
                }
            }
        });

        this.stackData.hooks.data.forEach(function (entry) {
            data = entry.f.apply(self, [data]);
        });
        var stackedData;
        this.stackData.hooks.after.forEach(function (entry) {
            stackedData = entry.f.apply(self, [data]);
        });

        var i = 0;
        this.series.series.forEach(function (series) {
            series.stack = stackedData[i++];
        });

        this.stackedData = stackedData;
        return stackedData;
    };

    this.stackData.hooks = { data: [], after: [] };

    this._slice = function (d) {

        if (this.window.xMin || this.window.xMax) {

            var isInRange = true;

            if (this.window.xMin && d.x < this.window.xMin) isInRange = false;
            if (this.window.xMax && d.x > this.window.xMax) isInRange = false;

            return isInRange;
        }

        return true;
    };


    this.registerRenderer = function (renderer) {
        this._renderers = this._renderers || {};
        this._renderers[renderer.name] = renderer;
    };

    this.configure = function (args) {
        if (args.width || args.height) {
            this.setSize(args);
        }
    };

    this.setRenderer = function (r, args) {
        this.renderer = this._renderers[r];
        this.renderer.configure(args);
    };

    this.setSize = function (args_) {
        var style = window.getComputedStyle(this.element, null);
        var elementWidth = parseInt(style.getPropertyValue('width'), 10);
        var elementHeight = parseInt(style.getPropertyValue('height'), 10);
        this.width = args_.width || elementWidth || 400;
        this.height = args_.height || elementHeight || 250;
        this.vis && this.vis.attr('width', this.width).attr('height', this.height);
    };

    this.initialize(args);
};

Lib.namespace('Lib.Fixtures.ChartData');


/*
 {
 series:[{
 color: "red",
 data: [{x,y,y0},{x,y,y0}],
 name: 'data_1'
 },
 series:[{
 color: "red",
 data: [{x,y,y0},{x,y,y0}],
 name: 'data_1'
 }
 ]
 }
 */
Lib.Fixtures.SeriesDecart = function (color, name) {
    this.data = [];
    this.color = color;
    this.name = name;
    this.addPoint = function (x, y) {
        this.data.push({x: x, y: y, y0: 0})
    }
    this.remPoint = function (ind) {
        if (ind < 0) {
            return;
        }
        this.data.splice(ind, 0)
    }
    return this;
}

Lib.Fixtures.ChartData = function () {
    this.series = [];
    this.addSeries = function (series) {
        this.series.push(series);
    }

    this.removeSeries = function (ser) {
        this.series.splice(this.series.indexOf(ser),1)
    };
};


Lib.namespace('Lib.Chart.Axis.X');

Lib.Chart.Axis.X = function (args) {

    var self = this;
    var berthRate = 0.10;

    this.initialize = function (args) {
        this.graph = args.graph;

        this.pixelsPerDelimer = args.pixelsPerDelimer || 10;
        if (args.ticks) this.staticTicks = args.ticks;

        this.tickSize = args.tickSize || 4;
        this.vis = this.graph.vis;
    };

    this.render = function () {
        var axis = d3.svg.axis().scale(this.graph.x).orient('top');
        axis.tickFormat(args.tickFormat || function (x) {
            return x
        });

        this.ticks = this.staticTicks || Math.floor(this.graph.width / this.pixelsPerDelimer);

        var berth = Math.floor(this.width * berthRate / 2) || 0;
        var transform;

        var yOffset = this.height || this.graph.height; //top oriented
        transform = 'translate(' + berth + ',' + yOffset + ')';

        this.vis
            .append("svg:g")
            .attr("transform", transform)
            .call(axis.ticks(this.ticks).tickSubdivide(0).tickSize(this.tickSize));

        var gridSize = -this.graph.height;

        this.graph.vis
            .append("svg:g")
            .attr("class", "x_grid_d3")
            .call(axis.ticks(this.ticks).tickSubdivide(0).tickSize(gridSize));
    };

    this.initialize(args);
};

Lib.namespace('Lib.Chart.Axis.Y');

Lib.Chart.Axis.Y = Lib.Class.create({

    initialize: function (args) {

        this.graph = args.graph;
        this.orientation = args.orientation || 'right';

        this.pixelsPerDelimer = args.pixelsPerDelimer || 10;
        if (args.ticks) this.staticTicks = args.ticks;


        this.tickSize = args.tickSize || 4;

        this.tickFormat = args.tickFormat || function (y) {
            return y
        };

        this.berthRate = 0.10;
        this.vis = this.graph.vis;
    },


    render: function () {
        this.ticks = this.staticTicks || Math.floor(this.graph.height / this.pixelsPerDelimer);

        var axis = this._drawAxis(this.graph.y);

        this._drawGrid(axis);
    },

    _drawAxis: function (scale) {
        var axis = d3.svg.axis().scale(scale).orient('right');
        axis.tickFormat(this.tickFormat);

        this.vis
            .append("svg:g")
            .call(axis.ticks(this.ticks).tickSubdivide(0).tickSize(this.tickSize));

        return axis;
    },
    _drawGrid: function (axis) {
        var gridSize = this.graph.width;

        this.graph.vis
            .append("svg:g")
            .attr("class", "y_grid")
            .call(axis.ticks(this.ticks).tickSubdivide(0).tickSize(gridSize));
    }
});

Lib.namespace('Lib.Chart.HoverDetail');

Lib.Chart.HoverDetail = Lib.Class.create({

    initialize: function (args) {

        var graph = this.graph = args.graph;

        this.coordFormatter = args.coordFormatter || function (y) {
            return y.toFixed(1);
        };

        var element = this.element = document.createElement('div');
        element.className = 'detail';

        graph.element.appendChild(element);

        this.lastEvent = null;
        this._addListeners();

        this.onShow = args.onShow;
        this.onHide = args.onHide;
        this.onRender = args.onRender;

        this.formatter = args.formatter || this.formatter;

    },

    formatter: function (series, x, y, formattedX, formattedY, d) {
        return series.name + ':&nbsp;&nbsp;&nbsp;{&nbsp;' + formattedX + '&nbsp;:&nbsp;' + formattedY + '&nbsp;}';
    },

    update: function (e) {

        e = e || this.lastEvent;
        if (!e) return;
        this.lastEvent = e;

        if (!e.target.nodeName.match(/^(path|svg|rect|circle)$/)) return;

        var graph = this.graph;

        var eventX = e.offsetX || e.layerX;
        var eventY = e.offsetY || e.layerY;

        var j = 0;
        var points = [];
        var nearestPoint;

        this.graph.series.active().forEach(function (series) {

            var data = this.graph.stackedData[j++];

            if (!data.length)
                return;

            var domainX = graph.x.invert(eventX);

            var domainIndexScale = d3.scale.linear()
                .domain([data[0].x, data.slice(-1)[0].x])
                .range([0, data.length - 1]);

            var approximateIndex = Math.round(domainIndexScale(domainX));
            if (approximateIndex == data.length - 1) approximateIndex--;

            var dataIndex = Math.min(approximateIndex || 0, data.length - 1);

            for (var i = approximateIndex; i < data.length - 1;) {

                if (!data[i] || !data[i + 1]) break;

                if (data[i].x <= domainX && data[i + 1].x > domainX) {
                    dataIndex = Math.abs(domainX - data[i].x) < Math.abs(domainX - data[i + 1].x) ? i : i + 1;
                    break;
                }

                if (data[i + 1].x <= domainX) {
                    i++
                } else {
                    i--
                }
            }

            if (dataIndex < 0) dataIndex = 0;
            var value = data[dataIndex];

            var distance = Math.sqrt(
                Math.pow(Math.abs(graph.x(value.x) - eventX), 2) +
                    Math.pow(Math.abs(graph.y(value.y + value.y0) - eventY), 2)
            );

            var coordFormatter = series.coordFormatter || this.coordFormatter;
            var coordFormatter = series.coordFormatter || this.coordFormatter;

            var point = {
                formattedXValue: coordFormatter(value.x),
                formattedYValue: coordFormatter(series.scale ? series.scale.invert(value.y) : value.y),
                series: series,
                value: value,
                distance: distance,
                order: j,
                name: series.name
            };

            if (!nearestPoint || distance < nearestPoint.distance) {
                nearestPoint = point;
            }

            points.push(point);

        }, this);

        nearestPoint.active = true;

        var domainX = nearestPoint.value.x;
        var formattedXValue = nearestPoint.formattedXValue;

        this.element.innerHTML = '';
        this.element.style.left = graph.x(domainX) + 'px';

        this.render({
            points: points,
            detail: points, // for backwards compatibility
            mouseX: eventX,
            mouseY: eventY,
            formattedXValue: formattedXValue,
            domainX: domainX
        });
    },

    render: function (args) {

        var graph = this.graph;
        var points = args.points;
        var point = points.filter(function (p) {
            return p.active
        }).shift();

        if (point.value.y === null) return;

        var formattedXValue = point.formattedXValue;
        var formattedYValue = point.formattedYValue;

        this.element.innerHTML = '';
        this.element.style.left = graph.x(point.value.x) + 'px';

        var xLabel = document.createElement('div');
        xLabel.className = 'x_label';
        xLabel.innerHTML = formattedXValue;
        this.element.appendChild(xLabel);

        var item = document.createElement('div');
        item.className = 'item';

        var series = point.series;
        var actualY = point.value.y;

        item.innerHTML = this.formatter(series, point.value.x, actualY, formattedXValue, formattedYValue, point);
        item.style.top = this.graph.y(point.value.y0 + point.value.y) + 'px';

        this.element.appendChild(item);

        var dot = document.createElement('div');

        dot.className = 'dot';
        dot.style.top = item.style.top;
        dot.style.borderColor = series.color;

        this.element.appendChild(dot);

        if (point.active) {
            item.classList.add('active');
            dot.classList.add('active');
        }
    },

    _addListeners: function () {

        this.graph.element.addEventListener(
            'mousemove',
            function (e) {
                this.update(e);
            }.bind(this),
            false
        );
    }
});

Lib.namespace('Lib.Chart.Legend');

Lib.Chart.Legend = Lib.Class.create({

    className: 'chart_legend',

    initialize: function (args) {
        this.element = args.element;
        this.graph = args.graph;
        this.element.classList.add(this.className);

        this.list = document.createElement('ul');
        this.element.appendChild(this.list);

        this.render();
    },

    render: function () {
        var self = this;

        while (this.list.firstChild) {
            this.list.removeChild(this.list.firstChild);
        }
        this.lines = [];

        console.log(this.graph.series.series)
        var series = this.graph.series.series
            .map(function (s) {
                return s
            });
        series.forEach(function (s) {
            self.addLine(s);
        });
    },

    addLine: function (series) {
        var line = document.createElement('li');
        line.className = 'line';

        var swatch = document.createElement('div');
        swatch.className = 'swatch';

        swatch.style.backgroundColor = series.color;

        line.appendChild(swatch);

        var label = document.createElement('span');
        label.className = 'label';
        label.innerHTML = series.name;

        line.appendChild(label);
        this.list.appendChild(line);

        line.series = series;

        if (series.noLegend) {
            line.style.display = 'none';
        }

        var _line = { element: line, series: series };
        if (this.shelving) {
            this.shelving.addAnchor(_line);
            this.shelving.updateBehaviour();
        }
        if (this.highlighter) {
            this.highlighter.addHighlightEvents(_line);
        }
        this.lines.push(_line);
        return line;
    }
});

Lib.namespace("Lib.Chart.Renderer");

Lib.Chart.Renderer = Lib.Class.create({

    initialize: function (args) {
        this.graph = args.graph;
        this.graph.unstacker = this.graph.unstacker || new Lib.Chart.Unstacker({ graph: this.graph });
    },

    defaults: function () {
        return {
            tension: 0.8,
            strokeWidth: 2,
            unstack: true,
            padding: { top: 0.01, right: 0, bottom: 0.01, left: 0 },
            stroke: false,
            fill: false
        };
    },

    domain: function (data) {

        var stackedData = data || this.graph.stackedData || this.graph.stackData();
        var firstPoint = stackedData[0][0];


        var xMin = firstPoint.x;
        var xMax = firstPoint.x;

        var yMin = firstPoint.y + firstPoint.y0;
        var yMax = firstPoint.y + firstPoint.y0;

        stackedData.forEach(function (series) {

            series.forEach(function (d) {
                if (d.y == null) return;

                var y = d.y + d.y0;
                if (y < yMin) yMin = y;
                if (y > yMax) yMax = y;
            });

            if (series[0].x < xMin) xMin = series[0].x;
            if (series[series.length - 1].x > xMax) xMax = series[series.length - 1].x;
        });

        xMin -= (xMax - xMin) * this.padding.left;
        xMax += (xMax - xMin) * this.padding.right;

        yMin = this.graph.min === 'auto' ? yMin : this.graph.min || 0;
        yMax = this.graph.max === undefined ? yMax : this.graph.max;

        yMax += (yMax - yMin) * this.padding.top;

        return { x: [xMin, xMax], y: [yMin, yMax] };
    },

    render: function (args) {

        args = args || {};

        var graph = this.graph;
        var series = args.series || graph.series;
        var vis = graph.vis;
        graph.vis.selectAll('*').remove();

        var data = series.series.map(function (s) {
            return s.stack
        });

        var nodes = vis.selectAll("path")
            .data(data)
            .enter().append("svg:path")
            .attr("d", this.seriesPathFactory());

        for (var i = 0; i < series.series.length; ++i) {
            console.log(series.series[i])
            series.series[i].path = nodes[0][i];
            this._styleSeries(series.series[i]);
        }
    },

    _styleSeries: function (series) {

        var fill = 'none';
        var stroke = series.color;

        console.log(stroke)

        series.path.setAttribute('fill', fill);
        series.path.setAttribute('stroke', stroke);
        series.path.setAttribute('stroke-width', this.strokeWidth);
        series.path.setAttribute('class', series.className);
    },

    configure: function (args) {

        args = args || {};

        Lib.keys(this.defaults()).forEach(function (key) {
            if (!args[key]) {
                this[key] = this[key] || this.graph[key] || this.defaults()[key];
                return;
            }

            Lib.keys(this.defaults()[key]).forEach(function (k) {
                this[key][k] = args[key][k] != null ? args[key][k] : this.defaults()[key][k];
            }, this);
        }, this);
    }
});
Lib.Chart.Renderer.Line = Lib.Class.create(Lib.Chart.Renderer, {

    name: 'line',

    defaults: function ($super) {
        return Lib.extend($super(), {});
    },

    seriesPathFactory: function () {

        var graph = this.graph;

        var factory = d3.svg.line()
            .x(function (d) {
                return graph.x(d.x)
            })
            .y(function (d) {
                return graph.y(d.y)
            })
            .interpolate(this.graph.interpolation).tension(this.tension);

        return factory;
    }
});
Lib.namespace('Lib.Chart.Unstacker');

Lib.Chart.Unstacker = function (args) {

    this.graph = args.graph;
    var self = this;

    this.graph.stackData.hooks.after.push({
        name: 'unstacker',
        f: function (data) {

            data.forEach(function (seriesData) {
                seriesData.forEach(function (d) {
                    d.y0 = 0;
                });
            });

            return data;
        }
    });
};
