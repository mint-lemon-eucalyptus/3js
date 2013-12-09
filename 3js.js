var Lib = {
    svgns: "http://www.w3.org/2000/svg",
    xlinkns: "http://www.w3.org/1999/xlink"
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Lib;
}

var sin60 = cos30 = Math.sqrt(3) / 2;
var sin30 = cos60 = 1 / 2;

Lib.TriAngChart = {};
Lib.TriAngChart = function (args) {
    var self = this;
    self.axisA = args.axisA;
    self.axisB = args.axisB;
    self.axisC = args.axisC;

    this.parentElement = args.parentElement;
    this.series = args.chartData;

    self.paddings = args.paddings;
    self.delimers = args.delimers;
    self.gridWidth = args.gridWidth;

    this.initialize = function (args) {
        this.width = args.edgeLength;
        this.height = this.width * sin60;
        this.scalingFactor = args.edgeLength / 100;

        //create svg element (root)
        self.svg = document.createElementNS(Lib.svgns, 'svg');
        self.parentElement.appendChild(self.svg);
        self.svg.setAttribute('width', this.width + 2 * this.paddings + 'px');
        self.svg.setAttribute('height', this.height + 2 * this.paddings + 'px');
        self.svg.setAttribute('version', "1.1");
        self.svg.setAttribute('xmlns', "http://www.w3.org/2000/svg");
        self.svg.setAttribute('xmlns:xlink', "1.1");

        //now Lib.TriAngChart.Renderer must draw the rest
        this.renderer = new Lib.TriAngChart.Renderer(this);
        this.renderer.render();
    };


    this.initialize(args);
};

Lib.TriAngChart.Renderer = {};

Lib.TriAngChart.Renderer = function (args) {
    var renderer = this;
    this.canvas = args.svg;
    this.data = args.series;
    this.charts = [];
    var edgeLength = args.width;
    var paddings = args.paddings;
    var height = edgeLength * sin60;
    var ox = 1, oy = 1, offsX = 0, offsY = 0;
    var scaling = args.width / 100;
    var aSc = (100) / edgeLength;
    var bSc = -(100) / height;
    var cSc = (args.axisC.max - args.axisC.min) / height;
    var aScale = (args.axisA.max - args.axisA.min) / 100;
    var bScale = (args.axisB.max - args.axisB.min) / 100;
    var cScale = (args.axisC.max - args.axisC.min) / 100;

    renderer.render = function () {
        //create axis and grid container
        renderer.Gsvg = renderer.g("axis-container");
        renderer.Gsvg.setAttribute('buffered-rendering', "dynamic")
        renderer.canvas.appendChild(renderer.Gsvg);
        renderer.applyNewCoordinates(paddings, height + paddings, 1, 1);
        drawAxises(args);

        //render data points
        for (var i = 0; i < args.series.series.length; ++i) {
            var a = args.series.series[i];
            var gp = renderer.g(a.name);
            renderer.canvas.appendChild(gp);
            console.log(a)
            var p = renderer.path(a.name, a.color, a.width);
            var pList = p.pathSegList;
            pList.clear();
            var beg = toDecart(a.data[0]);
            pList.appendItem(p.createSVGPathSegMovetoAbs(beg.x, beg.y))
            console.log(a)
            if (a.coordLabels) {
                var txt = text(beg.x - offsX, beg.y - offsY, formatLabel(a.data[0]), 'blue');
                gp.appendChild(txt)
                txt.setAttribute('font-size', '10px')
            }
            for (var j = 1; j < a.data.length; ++j) {
                var point = toDecart(a.data[j]);
                pList.appendItem(p.createSVGPathSegCurvetoQuadraticSmoothAbs(point.x, point.y));
                if (a.coordLabels) {
                    var txt = text(point.x - offsX, point.y - offsY, formatLabel(a.data[j]), 'black');
                    gp.appendChild(txt)
                    txt.setAttribute('font-size', '10px')
                }
            }
            if (compPoints(a.data[0], a.data[a.data.length - 1])) {
                var point = toDecart(a.data[0]);
                pList.appendItem(p.createSVGPathSegCurvetoQuadraticSmoothAbs(point.x, point.y));
            }
//            console.log(gp)
        }
    }
    function formatLabel(chartPoint) {
        return '(' + (chartPoint.a) + ', ' + (chartPoint.b) + ', ' + (chartPoint.c) + ')';
    }

    renderer.applyNewCoordinates = function (x, y, oxz, oyz) {
        offsX = Math.round(x);
        offsY = Math.round(y);
        ox = oxz;
        oy = oyz;
    }
    function compPoints(p, n) {
        return ((p.a == n.a) && (p.b == n.b) && (p.c == n.c));
    }

    //t={a:int,b:int,c:int}
    function toDecart(t) {
        var xn= (t.a-args.axisA.min)/aScale;
        var yn= (t.b-args.axisB.min)/bScale;
        var x = xn + yn * sin30;
        var y = yn * sin60;
        var res = {x: x * scaling + offsX, y: offsY - y * scaling};
        console.log(t)
        //       console.log(t, res)
        return res;
    }

    //t={x:int,y:int}
    this.fromDecart = function (x, y) {
        var b = (y - offsY) / sin60;
        var a = x - b * sin30;
        var res = {a: a - offsX, b: offsY - y};
        //       console.log(t, res)
        return res;
    }

    this.line = function (x1, y1, x2, y2, color, sw) {
        var d = document.createElementNS(Lib.svgns, 'line');
        d.setAttribute('x1', (x1 + offsX * ox));
        d.setAttribute('y1', y1 + offsY * oy);
        d.setAttribute('x2', x2 + offsX * ox);
        d.setAttribute('y2', y2 + offsY * oy);
        d.setAttribute('stroke', color);
        d.setAttribute('stroke-width', sw);
        return d;
    }

    function text(x, y, t, color) {
        var tx = document.createElementNS(Lib.svgns, 'text');
        tx.setAttribute('fill', color);
        tx.textContent = t;
        tx.setAttribute('x', (x + offsX * ox));
        tx.setAttribute('y', (y + offsY * oy));
        return tx;
    }

    function dottedLine(pars) {
        var gr = renderer.g(pars.id);
        var l1 = renderer.line(pars.x1, pars.y1, pars.x2, pars.y2, pars.color, pars.width)
        gr.appendChild(l1);
        var ax = new Axis(pars);
        var dx = (pars.x2 - pars.x1) / (pars.delims);
        var dy = (pars.y2 - pars.y1) / (pars.delims );
        var dl = (pars.max - pars.min) / (pars.delims );
        var w = 2 * pars.width;
        for (var i = 0; i < pars.delims; ++i) {
            var gg = renderer.g(pars.id + '_' + i);
            gr.appendChild(gg);
            var x1 = pars.x1 + i * dx;
            var y1 = pars.y1 + i * dy;
            var val = (dl * i + pars.min).toFixed(2);
            var tx = text(x1 + (pars.txoffs * val.length | 0), y1 + (pars.tyoffs * val.length | 0), val, pars.color);
            var r = renderer.rect(x1, y1, w, w, pars.color, 2);
            gg.appendChild(r);
            gg.appendChild(tx);

            ax.values.push({x: x1, y: y1, val: val})
        }
        renderer.axises.push(ax);
        return gr;
    }

    this.rect = function (x1, y1, w, h, color, sw) {
        var d = document.createElementNS(Lib.svgns, 'rect');
        d.setAttribute('x', (x1 + offsX * ox));
        d.setAttribute('y', (y1 + offsY * oy));
        d.setAttribute('width', w);
        d.setAttribute('height', h);
        d.setAttribute('fill', 'none');
        d.setAttribute('stroke', color);
        d.setAttribute('stroke-width', sw);
        return d;
    }

    this.rectLabeled = function (x, y, c, sw, txt) {
        var gr = renderer.g('r_labeled');
        var d = renderer.rect(-offsX * ox + x, -offsY * oy + y, txt.length * 14, 20, c, sw);
        var t = text(-offsX * ox + x, 15 - offsY * oy + y, txt, c);
        gr.appendChild(d);
        gr.appendChild(t);
        return gr;
    }
    this.g = function (id) {
        var e = document.createElementNS(Lib.svgns, 'g');
        e.setAttribute('id', id);
        return e;
    }

    //applicable to g elements only
    this.move = function (elem, newX, newY) {
        elem.setAttribute('transform', 'translate(' + newX + ',' + newY + ')')
    }

    //convert from offsetX, offsetY to local CS in percents
    this.toScreenCoords = function (x, y) {
        var nb = ((y - offsY) * bSc);
        var na = ((x - offsX) * aSc - nb / 2);
        var nc = 100 - nb - na;
        //console.log(na, args.axisA.min, aScale)
        return {
            a: na,// * aScale + args.axisA.min,
            b: nb,// * bScale + args.axisB.min,
            c: nc//*cScale+args.axisC.min
        };
    }
    function Axis(params) {
        var axis = this;
        axis.min = params.min;
        axis.max = params.max;
        axis.values = [];
        return axis;
    }

    this.fromScreenCoordinates = function (a, b, c) {
        return {a: (a * aScale + args.axisA.min).toFixed(2), b: (b * bScale + args.axisB.min).toFixed(2), c: (c * cScale + args.axisC.min).toFixed(2) };
        //return '(' + Math.round(a) + ',' + Math.round(b) + ',' + Math.round(c) + ')';
    }


    function drawAxises(args_) {
        renderer.axises = [];
        var t1 = dottedLine({
            id: 'a',
            x1: 0,
            y1: 0,
            x2: edgeLength,
            y2: 0,
            delims: args.delimers,
            color: 'blue',
            min: args_.axisA.min,
            max: args_.axisA.max,
            width: 1,
            tyoffs: 5,
            txoffs: -1
        });
        renderer.Gsvg.appendChild(t1);
        var t2 = dottedLine({
            id: 'b',
            x1: edgeLength,
            y1: 0,
            x2: edgeLength / 2,
            y2: -height,
            delims: args.delimers,
            color: 'green',
            min: args_.axisB.min,
            max: args_.axisB.max,
            width: 1,
            txoffs: 2
        });
        renderer.Gsvg.appendChild(t2);
        var t3 = dottedLine({
            id: 'c',
            x1: edgeLength / 2,
            y1: -height,
            x2: 0,
            y2: 0,
            delims: args.delimers,
            color: 'red',
            min: args_.axisC.min,
            max: args_.axisC.max,
            tyoffs: 1,
            txoffs: -9,
            width: 1
        });
        renderer.Gsvg.appendChild(t3);
        drawGrid(renderer.axises[2], renderer.axises[1], 'grid_a')
        drawGrid(renderer.axises[1], renderer.axises[0], 'grid_c')
        drawGrid(renderer.axises[2], renderer.axises[0], 'grid_b')
    }

    function drawGrid(a1, a2, gid) {
        var gr = renderer.g(gid);
        renderer.Gsvg.appendChild(gr);
        var max = a2.values.length;
        for (var i = 1; i < (a1.values.length); ++i) {
            var p1 = a1.values[i];
            var p2 = a2.values[max - i];
            var l = renderer.line(p1.x, p1.y, p2.x, p2.y, 'black', args.gridWidth);
            l.setAttribute('style', 'dotted');
            gr.appendChild(l);
        }
    }

    renderer.path = function (name, color,sw) {
        var p = document.createElementNS("http://www.w3.org/2000/svg", 'path');
        p.setAttribute('id', name)
        p.setAttribute('stroke', color)
        p.setAttribute('stroke-width', sw)
        p.setAttribute('fill', 'none')
        renderer.canvas.appendChild(p);
        return p;
    }
    return renderer;
};


Lib.Fixtures = {};


Lib.TriAngChart.HoverDetail = function (args) {
    var hover = this;
    var graph = this.graph = args.graph;
    var renderer = this.graph.renderer;
    var el = renderer.rectLabeled(20, 20, 'black', 1, '(000,000,000)');
    var cel = renderer.rect(-graph.paddings - 2, -graph.height - graph.paddings - 3, 4, 4, 'black', 2);
    /*
     var al = renderer.g('al').appendChild(renderer.rect(-3, 0, 5, 5, 'black', 1))
     var bl = renderer.g('bl').appendChild(renderer.rect(graph.width/2 - 3, 0, 5, 5, 'black', 1))
     var cl = renderer.g('cl').appendChild(renderer.rect(-3, 0, 5, 5, 'black', 1))
     renderer.Gsvg.appendChild(al)
     renderer.Gsvg.appendChild(bl)
     renderer.Gsvg.appendChild(cl)
     */
//    el.setAttribute('display','none')
    renderer.Gsvg.appendChild(el)
    renderer.Gsvg.appendChild(cel)


    el.className = 'detail';
    renderer.move(el,-100,-200)
    renderer.move(cel,-100,-200)
    renderer.canvas.addEventListener(
        'mousemove',
        function (e) {
            if ((e.toElement.nodeName !== 'text')) {
                renderer.move(el, e.offsetX, e.offsetY);
                var coords = renderer.toScreenCoords(e.offsetX, e.offsetY);
                renderer.move(cel, e.offsetX,e.offsetY);
                var trueCoords = renderer.fromScreenCoordinates(coords.a, coords.b, coords.c);
                el.lastChild.textContent = format(trueCoords)
            }
        }.bind(this),
        false
    );

    function format(ts) {
        return '{' + ts.a + ',' + ts.b + ',' + ts.c + '}';
    }

    return this;
};


Lib.Fixtures.SeriesTriang = function (color, name) {
    this.data = [];
    this.color = color;
    this.name = name;
    this.addPoint = function (a, b, c, t) {
        this.data.push({a: a, b: b, c: c, t: t})
    }
    this.remPoint = function (ind) {
        if (ind < 0) {
            return;
        }
        this.data.splice(ind, 0)
    }
    return this;
}

Lib.Fixtures.SeriesJson = function (json) {
    this.data = [];
    this.color = json.color ? json.color : 'black';
    this.name = json.id ? json.id : '';
    this.width=json.width?json.width:1;
    this.coordLabels=json.coordLabels?json.coordLabels:false;
    for (var i = 0; i < json.data.length; ++i) {
        this.data = json.data;
    }
    return this;
}

Lib.Fixtures.ChartData = function () {
    this.series = [];
    this.addSeries = function (series) {
        this.series.push(series);
    }

    this.removeSeries = function (ser) {
        this.series.splice(this.series.indexOf(ser), 1)
    };
};

