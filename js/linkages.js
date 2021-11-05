/********************* 
 * TODO:
 * 	[] Allow for more than 2 arms
 * 	[] Allow for extended arm where point intersects in middle and not at end
 *  [] If > 2 arms, make sure the arms that determine location of point are in a and b (reshuffle if not)
 *  [] Allow for editing arm length
 *  [] Allow for multiple rotor arms
 *  [] Allow for extended rotor arm
 * 		- OR, allow for multiple rotor arms, but define degree separation.
 * 		- E.g., An extend motor arm is the same as 2 motor arms with equal length 180 deg apart
*********************/
function vectorLen(a, b) {
	return ((b.x-a.x)**2+(b.y-a.y)**2)**.5;
}

class Point {
	constructor(x, y, label, type, name) {
		this.x = x;
		this.y = y;
		this.startX = x;
		this.startY = y;
		this.label = label;
		this.type = type;
		this.a = null;
		this.b = null;
		this.aArm = null;
		this.bArm = null;
		this.dir = null;
		this.rotateFrom = null;
		this.hide = false;
		this.mechName = name;
		this.analyze = false;
		this.error = false;
	}

	printCoords() {
		console.log(this.x, this.y);
	};

	reset() {
		this.x = this.startX;
		this.y = this.startY;
	};

	calcThings() {
		this.d = vectorLen(this.a, this.b);
		this.dx = (arms[this.aArm].len**2 + this.d**2 - arms[this.bArm].len**2) / (2 * this.d);
		this.dy = (arms[this.aArm].len**2 - this.dx**2)**.5;
		if (isNaN(this.dy)) {
			console.log("ERROR");
			this.error = true;
			// TODO: highlight this point (currently it disappears)
			// This is because the point has no X or Y value so has no where to be drawn...
		}
		this.v = {'x': (this.b.x - this.a.x) / this.d, 'y': (this.b.y - this.a.y) / this.d};
		this.ctr = {'x': this.v.x * this.dx + this.a.x, 'y': this.v.y * this.dx + this.a.y};
		// TODO: round to 3 decimal places?
		if (this.dir === null || this.dir === 90) {
			this.v90 = {
				'x': this.v.x*Math.cos(90*Math.PI/180) - this.v.y*Math.sin(90*Math.PI/180),
				'y': this.v.x*Math.sin(90*Math.PI/180) + this.v.y*Math.cos(90*Math.PI/180)
			};
			this.pnt90 = {'x': this.ctr.x+this.dy*this.v90.x, 'y': this.ctr.y+this.dy*this.v90.y}
		}
		if (this.dir === null || this.dir === 270) {
			this.v270 = {
				'x': this.v.x*Math.cos(270*Math.PI/180) - this.v.y*Math.sin(270*Math.PI/180),
				'y': this.v.x*Math.sin(270*Math.PI/180) + this.v.y*Math.cos(270*Math.PI/180)
			};
			this.pnt270 = {'x': this.ctr.x+this.dy*this.v270.x, 'y': this.ctr.y+this.dy*this.v270.y}
		}

		if (this.dir === null) {
			if (this.x.toPrecision(7) === this.pnt90.x.toPrecision(7) && this.y.toPrecision(7) === this.pnt90.y.toPrecision(7)) {
				console.log("null dir is now 90");
				this.dir = 90;
				this.pnt = this.pnt90;
				if (this.x.toPrecision(7) === this.pnt270.x.toPrecision(7) && this.y.toPrecision(7) === this.pnt270.y.toPrecision(7)) {
					console.log("and ALSO 270");
				}
			} else if (this.x.toPrecision(7) === this.pnt270.x.toPrecision(7) && this.y.toPrecision(7) === this.pnt270.y.toPrecision(7)) {
				console.log("null dir is now 270");
				this.dir = 270;
				this.pnt = this.pnt270;
			} else {
				// NOT GOOD
				console.log("ERORR on point: ", this.label, "cannot match direction");
				console.log(this);
				sys.errorPoints.push(this.label);
			}
		} else {
			if (this.dir === 90) {
				this.pnt = this.pnt90;
				this.x = this.pnt90.x;
				this.y = this.pnt90.y;
			} else {
				this.pnt = this.pnt270;
				this.x = this.pnt270.x;
				this.y = this.pnt270.y;
			}
		}
	};
}

class Arm {
	constructor(pntA, pntB) {
		this.pntA = pntA;
		this.pntB = pntB;
		this.label = pntA.label.toString()+pntB.label.toString();
		this.len = vectorLen(pntA, pntB);
		// this.len = ((pntA.x-pntB.x)**2+(pntA.y-pntB.y)**2)**.5;
	}

	calcLen() {
		this.len = vectorLen(this.pntA, this.pntB);
	}

	printLen() {
		console.log(this.len);
	}
}

/********************************************
 *
 * Global variables
 *
********************************************/
let canvas = document.getElementById('mech');
let ctx = canvas.getContext('2d');
let canvasRect = canvas.getBoundingClientRect()
let addFixed = document.getElementById("fixed");
let addRotor = document.getElementById("rotor");
let addMove = document.getElementById("move");
let inst = document.getElementById("inst");
let old_inst = null;
let add = document.getElementById('add');
let pos = document.getElementById('pos');
let len = document.getElementById('len');
let UIStatus = document.getElementById('status');
let rotor = null;
let degs = 0;
let sys = {
	'status':  {'stopped': true},
	'activePoint': {'point': null, 'status': null},
	'hoverPoint': {'point': null},
	'errorPoints': []
}
updateStatusUI();
let mouse = {'x': null, 'y': null};
let mouseDown = false; 
let mouseDownPos = null;
// For auto run, tick 1 degree at a time
let runDegree = 1;
document.getElementById('deg').value = runDegree;
let intTime = 20;
let speed = 50; // deg / second
document.getElementById('speed').value = speed;
let interval = null;
let armFirstPoint = {'existing': null, 'point': null};
let liveMech = false;
let paths = {};
let oldPaths = [];

// (x,y) -> +x moves right
// 		 -> +y moves down
// move the x-axis to the bottom
ctx.translate(0, canvas.height);
// flip the y-axis so it 0 is at the bottom
ctx.scale(1, -1);
	
const tickit = document.getElementById('tick');
tickit.addEventListener('click', handleTick);
const restartit = document.getElementById('restart');
restartit.addEventListener('click', restart);
const runit = document.getElementById('run');
runit.addEventListener('click', run);
const mechSelect = document.getElementById('mechs');
mechSelect.addEventListener('change', loadMech);
const mechsLabel = document.getElementById('mechsLabel');
const mechRemove = document.getElementById('remove');
mechRemove.addEventListener('click', handleRemoveMech);
addFixed.addEventListener('click', updateInputting);
addRotor.addEventListener('click', updateInputting);
addMove.addEventListener('click', updateInputting);
const undo = document.getElementById('undo');
const redo = document.getElementById('redo');
undo.addEventListener('click', handleNavHistory);
redo.addEventListener('click', handleNavHistory);
const speedInput = document.getElementById('speed');
speedInput.addEventListener('change', updateSpeed);

const savedMechs = {
	'jensen': '[{"x":350,"y":350,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":274,"y":334.4,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":379.34,"y":356.24,"a":0,"b":3,"type":"rotor","rotateFrom":0},{"x":297.68,"y":413.95,"a":2,"b":1,"type":"move","rotateFrom":null},{"x":300.83,"y":260.52,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":198.79,"y":362.23,"a":1,"b":3,"type":"move","rotateFrom":null},{"x":234.52,"y":292.01,"a":4,"b":5,"type":"move","rotateFrom":null},{"x":273.32,"y":166.46,"a":4,"b":6,"type":"move","rotateFrom":null}]',
	//'lambda': '[{"x":300,"y":300,"a":3,"b":null,"type":"fixed","rotateFrom":null},{"x":340","y"300","a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":360,"y":300,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":330,"y":340,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":300,"y":380,"a"'
	'test': '[{"x":196,"y":286,"a":3,"b":null,"type":"fixed","rotateFrom":null},{"x":313,"y":291,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":274.40247371306754,"y":331.990620445775,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":227.34753709875397,"y":446.2352393134614,"a":2,"b":0,"type":"move","rotateFrom":null}]',
	'kite': '[{"x":310,"y":441,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":310,"y":370,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":310,"y":419,"a":0,"b":4,"type":"rotor","rotateFrom":0},{"x":390,"y":370,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":230,"y":370,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":310,"y":270,"a":3,"b":4,"type":"move","rotateFrom":null}]',
	'kite_half_1_pnt': '[{"x":310,"y":441,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":310,"y":370,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":294.17452439254964,"y":425.71751584990204,"a":0,"b":3,"type":"rotor","rotateFrom":0},{"x":384.29750278377696,"y":399.66278948606583,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":231.20287672528005,"y":356.1792415682572,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":421.37598964135924,"y":306.79091100634463,"a":1,"b":3,"type":"move","rotateFrom":null},{"x":248.47882476495852,"y":257.6828374748573,"a":1,"b":4,"type":"move","rotateFrom":null},{"x":359.8548144063177,"y":194.47374848120194,"a":6,"b":5,"type":"move","rotateFrom":null}]',
	'kite_diamond': '[{"x":310,"y":441,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":310,"y":370,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":310,"y":419,"a":0,"b":3,"type":"rotor","rotateFrom":0},{"x":390,"y":370,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":230,"y":370,"a":1,"b":2,"type":"move","rotateFrom":null},{"x":347.00625,"y":270.4232082213054,"a":1,"b":3,"type":"move","rotateFrom":null},{"x":269,"y":272,"a":1,"b":4,"type":"move","rotateFrom":null},{"x":311.39897678334427,"y":171.61540149256655,"a":6,"b":5,"type":"move","rotateFrom":null}]',
	'cheby_missing': '[{"x":200,"y":250,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":400,"y":250,"a":3,"b":null,"type":"fixed","rotateFrom":null},{"x":142.64235636489,"y":168.08479557109558,"a":0,"b":3,"type":"rotor","rotateFrom":0},{"x":207.49165055476254,"y":409.57924487185153,"a":1,"b":2,"type":"move","rotateFrom":null}]',
	'straight_01': '[{"x":221,"y":415,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":371,"y":417,"a":2,"b":5,"type":"fixed","rotateFrom":null},{"x":345.987456181419,"y":380.74572229757723,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":153.30416558508236,"y":260.6035168701435,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":365.5172069833204,"y":263.8451890089497,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":443.0026942539827,"y":325.91426006137146,"a":1,"b":4,"type":"move","rotateFrom":null},{"x":345.0681542318976,"y":149.9405025618215,"a":4,"b":5,"type":"move","rotateFrom":null}]',
	'leg_01': '[{"x":221,"y":415,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":371,"y":417,"a":2,"b":5,"type":"fixed","rotateFrom":null},{"x":359.3053652800903,"y":459.46452070574793,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":265.8876164156427,"y":252.50045571595552,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":422.5504089722239,"y":359.22874716191785,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":485.5491490651739,"y":435.96028608551495,"a":1,"b":4,"type":"move","rotateFrom":null},{"x":426.0625286566583,"y":243.5563374508235,"a":4,"b":5,"type":"move","rotateFrom":null},{"x":316.219659388779,"y":76.68268665512454,"a":3,"b":6,"type":"move","rotateFrom":null}]',
	'leg_02': '[{"x":221,"y":415,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":371,"y":417,"a":2,"b":5,"type":"fixed","rotateFrom":null},{"x":344.24943406002825,"y":451.99153071661306,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":244.40952608506862,"y":248.04792876854597,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":423.85697536682545,"y":364.1861480989373,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":484.14396942904153,"y":443.06611175147,"a":1,"b":4,"type":"move","rotateFrom":null},{"x":431.3972426790191,"y":248.70634154424246,"a":4,"b":5,"type":"move","rotateFrom":null},{"x":369.54650667338035,"y":130.3525157842293,"a":3,"b":6,"type":"move","rotateFrom":null}]',
	'leg_big_bend_back': '[{"x":221,"y":415,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":371,"y":417,"a":2,"b":5,"type":"fixed","rotateFrom":null},{"x":337.55884979195264,"y":445.6651264215468,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":238.7492644261729,"y":247.3516668370073,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":364.2015310715802,"y":351.0756580107761,"a":0,"b":2,"type":"move","rotateFrom":null},{"x":432.4175409057623,"y":363.2237443745939,"a":1,"b":4,"type":"move","rotateFrom":null},{"x":315.5238470596087,"y":265.8390676838577,"a":4,"b":5,"type":"move","rotateFrom":null},{"x":369.39154262294335,"y":135.79867810131282,"a":3,"b":6,"type":"move","rotateFrom":null}]',
	'two_legs': '[{"x":188,"y":328,"a":3,"b":4,"type":"fixed","rotateFrom":null},{"x":396,"y":323,"a":2,"b":null,"type":"fixed","rotateFrom":null},{"x":422,"y":402,"a":1,"b":3,"type":"rotor","rotateFrom":1},{"x":270.00000000000006,"y":558,"a":2,"b":0,"type":"move","rotateFrom":null},{"x":282.9999999999999,"y":98.99999999999993,"a":0,"b":3,"type":"move","rotateFrom":null},{"x":357.99999999999994,"y":99.00000000000006,"a":3,"b":2,"type":"move","rotateFrom":null}]'
}

Object.keys(savedMechs).forEach(key => {
	let opt = document.createElement("option");
	opt.value = key;
	opt.text = key;
	mechSelect.add(opt);
});


/********************************************
 *
 * Canvas draw functions
 *
********************************************/
function drawPoints() {
	ctx.clearRect(0,0, canvas.width, canvas.height);
	// draw fixed points
	if (fixed) {
		fixed.forEach(point => {
			ctx.fillStyle = 'black';
			ctx.beginPath();
			ctx.arc(point.x, point.y, 5, 0, Math.PI * 2, true);
			ctx.fill();
			if ([sys.activePoint.point, sys.hoverPoint.point].includes(point.label)) {
				ctx.fillStyle = 'rgb(0, 0, 200, .5)';
				ctx.beginPath();
				ctx.arc(point.x, point.y, 10, 0, Math.PI * 2, true);
				ctx.fill();
			}
		});
	}
	// draw rotor point
	if (rotor) {
		ctx.fillStyle = 'green';
		ctx.beginPath();
		ctx.arc(rotor.x, rotor.y, 5, 0, Math.PI * 2, true);
		ctx.fill();
		if ([sys.activePoint.point, sys.hoverPoint.point].includes(rotor.label)) {
			ctx.fillStyle = 'rgb(0, 0, 200, .5)';
			ctx.beginPath();
			ctx.arc(rotor.x, rotor.y, 10, 0, Math.PI * 2, true);
			ctx.fill();
		}

		// draw rotor arm
		if (rotor.rotateFrom) {
			ctx.beginPath();
			ctx.moveTo(rotor.rotateFrom.x, rotor.rotateFrom.y);
			ctx.lineTo(rotor.x, rotor.y);
			ctx.closePath();
			ctx.stroke();
		}
	}

	// draw all moving points
	moves.forEach(point => {
		ctx.fillStyle = 'blue';
		ctx.beginPath();
		ctx.arc(point.x, point.y, 5, 0, Math.PI * 2, true);
		if (point.analyze) {
			if (paths[point.label].length <= 360) {
				paths[point.label].push({'x': point.x, 'y': point.y});
			}
		}
		ctx.fill();
		if ([sys.activePoint.point, sys.hoverPoint.point].concat(sys.errorPoints).includes(point.label)) {
			if ([sys.activePoint.point, sys.hoverPoint.point].includes(point.label)) {
				ctx.fillStyle = 'rgb(0, 0, 200, .5)';
			} else {
				ctx.fillStyle = 'rgb(255, 0, 0, .5)';
			}
			ctx.beginPath();
			ctx.arc(point.x, point.y, 10, 0, Math.PI * 2, true);
			ctx.fill();
		}

		if (point.a) {
			ctx.beginPath();
			ctx.moveTo(point.x, point.y);
			ctx.lineTo(point.a.x, point.a.y);
			ctx.stroke();
		}
		if (point.b) {
			ctx.beginPath();
			ctx.moveTo(point.x, point.y);
			ctx.lineTo(point.b.x, point.b.y);
			ctx.stroke();
		}
	});
	drawPaths();
}


function drawPaths() {
	Object.keys(paths).forEach(key => {
		ctx.strokeStyle='blue';
		ctx.beginPath();
		paths[key].forEach((v, k) => {
			if (k === 0) {
				ctx.moveTo(v.x, v.y);
			} else {
				ctx.lineTo(v.x, v.y);
			}
		});
		ctx.stroke();
	});
	if (sys.status.adding) {
		if (sys.status.adding.order === 2) {
			drawArmLine();
		}
	}
	oldPaths.forEach(path => {
		ctx.strokeStyle='grey';
		ctx.beginPath();
		path.forEach((v, k) => {
			if (k === 0) {
				ctx.moveTo(v.x, v.y);
			} else {
				ctx.lineTo(v.x, v.y);
			}
		});
		ctx.stroke();
	})
}

function drawArmLine() {
	// From armFirstPoint
	// To mouse location (takes in click)
	ctx.strokeStyle='blue';
	ctx.beginPath();
	ctx.moveTo(armFirstPoint.point.x, armFirstPoint.point.y);
	ctx.lineTo(mouse.x, mouse.y);
	ctx.stroke();
}

	

/********************************************
 *
 * Movement
 *
********************************************/
function handleTick(event) {
	event.preventDefault();
	let degInput = document.getElementById('deg');
	let deg = parseInt(degInput.value);
	tick(deg);
}

function tick(deg, draw = true) {
	if (typeof deg === 'undefined') {
		deg = runDegree;;
	}
	moveRotor(deg);
	moves.forEach(point => point.calcThings());
	if (draw) { drawPoints(); }
}

function try360() {
	if (pointsArr.length >= 5) console.log("Top of try360 Pnt 4: ", pointsArr[4].x, pointsArr[4].y);
	let errors = new Set();
	let i = 0;
	while (i < 360) {
		tick(1, false);
		//moves.forEach(point => error = point.error ? true : error);
		moves.forEach(point => {
			if (point.error) errors.add(point.label);
		});
		i += 1;
	}
	console.log("Check: " + i + " ticks run");
	console.log(errors);
	if (errors.size > 0) {
		console.log("ERROR when checking. Points with fail: " + [...errors].join());
		sys.errorPoints = [...errors];
		// TODO: Better error alerting
		// Highlight row in red in addition to highlighting points
		// Display an error message?
		drawPoints();
	} else {
		console.log("Check -> no errors");
		sys.errorPoints = [];
		// try360 may MOVE the points from where originally set especially if not a complete answer.
		if (pointsArr.length >= 5) console.log("End of try360 Pnt 4: ", pointsArr[4].x, pointsArr[4].y);
		// Compare points if points after 360 rotation are different than original, then mech has a non-deterministic joint
		// TODO: count # differences and if > 0 return ERROR
		for (i=0; i < pointsArr.length; i++) {
			if (Math.round(pointsArr[i].x) != Math.round(history[iteration][i].x)) console.log("pnt ", i, "x does not match");
			if (Math.round(pointsArr[i].y) != Math.round(history[iteration][i].y)) console.log("pnt ", i, "x does not match");
		}
		removeMech(mechRemove.value);
		mechFromArr(history[iteration], mechRemove.value);
	}
}

function moveRotor(deg) {
	degs += deg;

	let rad = deg * Math.PI / 180;
	// Assume at 0, 0
	let X = rotor.x - rotor.rotateFrom.x;
	let Y = rotor.y - rotor.rotateFrom.y;
	let newX = X * Math.cos(rad) - Y * Math.sin(rad);
	let newY = X * Math.sin(rad) + Y * Math.cos(rad);
	rotor.x = newX + rotor.rotateFrom.x;
	rotor.y = newY + rotor.rotateFrom.y;
}

function restart(e) {
	e.preventDefault();
	window.clearInterval(interval);
	pointsArr.forEach(point => point.reset());
	moves.forEach(point => point.calcThings());
	Object.keys(paths).forEach(path => {
		pointsArr[path].analyze = false;
	});
	paths = {};
	drawPoints();
	updateTable();
}

function updateSpeed() {
	speed = parseInt(speedInput.value);
	if (sys.status.running) {
		window.clearInterval(interval);
		interval = window.setInterval(tick, (360/speed*1000)/360);
	}
}

function run(event) {
	event.preventDefault();
	if (sys.status.running) {
		// stop it
		updateStatus('status', {'stopped': true});
		window.clearInterval(interval);
		runit.disabled = false;
		tickit.disabled = false;
		restartit.disabled = false;
		addFixed.disabled = false;
		addRotor.disabled = false;
		addMove.disabled = false;
		runit.innerHTML = "Run";
	} else {
		// Check if all calcs are right
		let errors = 0
		moves.forEach(point => {
			// Check that all moves points have a and b froms
			if (!point.a) {
				console.log("WARNING: Point", point.label, "missing 'a' from.");
				errors += 1;
				sys.errorPoints.push(point.label);
			} else if (!point.b) {
				console.log("WARNING: Point", point.label, "missing 'b' from.");
				errors += 1;
				sys.errorPoints.push(point.label);
			}
		});

		if (errors === 0) {
			// point.calcThings();
			drawPoints();
			updateTable();
			updateStatus('status', {'running': true});
			//interval = window.setInterval(tick, intTime);
			speed = parseInt(speedInput.value);
			interval = window.setInterval(tick, (360/speed*1000)/360);
			tickit.disabled = true;
			restartit.disabled = true;
			addFixed.disabled = true;
			addRotor.disabled = true;
			addMove.disabled = true;
			runit.innerHTML = "Stop";
		} else {
			alert("Finish adding arms (all moving points must have at least 2 arms).");
			// TODO: highlight error points using sys.errorPoints?
		}
	}
}

/********************************************
 *
 * User feedback & Status
 *
********************************************/
function updateStatus(key, val) {
	sys[key] = val;
	updateStatusUI();
}

function updateStatusUI() {
	let s = 'Status: ';
	if (sys.status.adding) {
		s += "adding: " + sys.status.adding.type + ": " + sys.status.adding.order;
	} else {
		s += sys.status.stopped ? 'stopped' : 'running';
	}

	let a = "Active Point (" + sys.activePoint.status + "): " + sys.activePoint.point;
	let h = "Hover Point: " + sys.hoverPoint.point;
	let e = "Error Points:";
	sys.errorPoints.forEach(ep => {
		e += " " + ep;
	});
	UIStatus.innerHTML = s + "<br>" + a + "<br>" + h + "<br>" + e;
}



function tableWhite() {
	let tableRows = document.getElementById("table").getElementsByTagName("tr");
	for (let row of tableRows) {
		row.style.backgroundColor = "white";
	}
}

function updateTable() {
	let table = document.getElementById('table');
	// delete existing tbody
	let tbody = document.getElementsByTagName('tbody')[0];
	table.removeChild(tbody);

	// add header
	let newRow = table.insertRow();
	newRow.innerHTML = "<th>#</th><th>X</th><th>Y</th><th>Type</th><th>Arm 1</th><th>Arm 2</th><th>Path</th><th>Edit</th>";

	// add rows per point
	pointsArr.forEach(point => {
		newRow = table.insertRow();
		newRow.id = "pnt"+point.label;
		if (sys.activePoint.point === point.label) {
			newRow.style.backgroundColor = "lightgreen";
		}
		newCell = newRow.insertCell();
		newCell.innerText = point.label;
		newCell = newRow.insertCell();
		newCell.innerHTML = `<input type='text' class='x' id=${point.label}.x style='width: 45px;' value=${point.x.toPrecision(5)}>`;
		newCell = newRow.insertCell();
		newCell.innerHTML = `<input type='text' class='y' id=${point.label}.y style='width: 45px;' value=${point.y.toPrecision(5)}>`;
		newCell = newRow.insertCell();
		newCell.innerText = point.type;
		newCell = newRow.insertCell();
		if (point.aArm != null) {
			newCell.innerText = point.aArm + " (" + arms[point.aArm].len.toPrecision(4) + ")";
		} else {
			newCell.innerText = "tbd";
		}

		newCell = newRow.insertCell();
		if (point.bArm != null) {
			newCell.innerText = point.bArm + " (" + arms[point.bArm].len.toPrecision(4) + ")";
		} else {
			newCell.innerText = "tbd";
		}
		newCell = newRow.insertCell();
		if (point.analyze && point.type === 'move') {
			// selected checkbox
			newCell.innerHTML = "<input type='checkbox' class='analyze' name='"+point.label+"' onchange='handleAnalyze(this)' checked>";
		} else if (point.type === 'move') {
			// unselected checkbox
			newCell.innerHTML = "<input type='checkbox' class='analyze' name='"+point.label+"' onclick='handleAnalyze(this)'>";
		}
		newCell = newRow.insertCell();
		if (sys.status.stopped && sys.activePoint.point === point.label) {
				newCell.innerHTML = "<button id='deletePoint' onclick='removePoint("+point.label+")'>Delete</button>";
		} else {
			newCell.innerHTML = "<button id='updatePoint' onclick='handleUpdatePoint("+point.label+")'>Update</button>";
		}
	});
}

function handleAnalyze(e) {
	paths[e.name] = [];
	pointsArr[e.name].analyze = e.checked;
}

function resetButtonsAndStatus(id) {
	document.getElementById(id).className = "unpressed";
	inst.innerHTML = "Choose the next point type";
	runit.disabled = false;
	tickit.disabled = false;
	addFixed.disabled = false;
	addRotor.disabled = false;
	addMove.disabled = false;
	sys.status = {'stopped': true};
	sys.activePoint.point = null;
	sys.activePoint.status = null;
	updateStatusUI();
}

function updateInputting(e) {
	if (e.target.className === "depressed") {
		resetButtonsAndStatus(e.target.id);
	} else {
		e.target.className = "depressed";
		updateStatus('status', {'adding': {'type': e.target.id}});
		// clear existing selections
		updateStatus('activePoint', {'point': null, 'status': null});
		drawPoints();
		updateTable();
		runit.disabled = true;
		tickit.disabled = true;
		if (e.target.id === "fixed") {
			inst.innerHTML = "Click to place a single, fixed point (point will not move)";
			addRotor.disabled = true;
			addMove.disabled = true;
			updateStatus('status', {'adding': {'type': 'fixed'}});
		} else if (e.target.id === "rotor") {
			inst.innerHTML = "One end of the rotor arm must be connected to a fixed point."; 
			addFixed.disabled = true;
			addMove.disabled = true;
			updateStatus('status', {'adding': {'type': 'rotor', 'order': 1}});
		} else if (e.target.id === "move") {
			inst.innerHTML = "Connect 2 points. Click anywhere to create new point.";
			addFixed.disabled = true;
			addRotor.disabled = true;
			updateStatus('status', {'adding': {'type': 'move', 'order': 1}});
		}
	}
}

// Call after adding Regular arm
function finishAdding() {
	moves.forEach(point => {
		// Check that all moves points have a and b froms
		if (!point.a) {
			console.log("WARNING: Point", point.label, "missing 'a' from.");
			sys.errorPoints.push(point.label);
		} else if (!point.b) {
			console.log("WARNING: Point", point.label, "missing 'b' from.");
			sys.errorPoints.push(point.label);
		} else {
			point.calcThings();
			const index = sys.errorPoints.indexOf(point.label);
			if (index > -1) {
				sys.errorPoints.splice(index, 1);
			}
		}
	});
	drawPoints();
	updateTable();
	if (sys.errorPoints.length === 0) {
		console.log("trying 360");
		// handle error better 
		try360();
	}
}

function enableRemoveMechButton(name = 'default') {
	liveMech = true;
	document.getElementById('mechs').style.display = 'none';
	mechsLabel.style.display = 'none';
	mechRemove.innerText = "Remove "+name;
	mechRemove.value = name === '' ? 'default' : name;
	mechRemove.style.display = 'block';
}

function handleRemoveMech(e) {
	// e.preventDefault();
	mechRemove.style.display = 'none';
	mechSelect.selectedIndex = 0;
	mechSelect.style.display = 'block';
	mechsLabel.style.display = 'block';
	removeMech(mechRemove.value);
	document.getElementById('history').style.display='none';
	paths = {};
	oldPaths = [];
	iteration = -1;
	currentHistory = -1;
	history = [];
	drawPoints();
	mechRemove.innerText = "Remove";
	mechRemove.value = "";
}



/********************************************
 *
 * Handle mouse interactions 
 *
********************************************/
function coordsInPoint(coords) {
	let pointer = null;
	pointsArr.some(point => {
		if ((coords.x - point.x)**2 + (coords.y - point.y)**2 < 5**2) {
			pointer = point;
		}
	});
	return pointer;;
}

canvas.addEventListener('mousemove', e => {
	mouse = {'x': e.clientX - canvasRect.x, 'y': canvas.height - (e.clientY - canvasRect.y)};
	if (mouseDown) {
		if (sys.status.stopped) {
			// Could be a drag
			if ((mouse.x - mouseDownPos.x)**2 + (mouse.y - mouseDownPos.y)**2 > 5**2) {
				// it's a drag
				if (sys.activePoint.point != null) {
					updateStatus('activePoint', {'point': sys.activePoint.point, 'status': 'moving'});
				} 
				if (sys.activePoint.status === 'moving') {
					updatePoint(sys.activePoint.point, mouse.x, mouse.y);
					drawPoints();
					pos.innerHTML = mouse.x + ", " + mouse.y;
				}
			}
		}
	} else {
		if (sys.status.adding) {
			if (sys.status.adding.order === 2) {
				drawPoints();
				let length = vectorLen({"x":mouse.x,"y":mouse.y}, armFirstPoint.point);
				len.innerHTML = "| length: " + length;
			}
		}
		let point = coordsInPoint(mouse);
		pos.innerHTML = mouse.x + ", " + mouse.y;
		if (point === null) {
			if (sys.hoverPoint.point != null) { // if (sys.hover) ???
				updateStatus('hoverPoint', {'point': null});
				console.log("point is null and hoverPoint != null");
				drawPoints();
			} else {
				return true;
			}
		} else {
			console.log("IN", point.label);
			updateStatus('hoverPoint', {'point': point.label});
			drawPoints();
		}
	}
});

canvas.addEventListener('click', function(e) {
	// console.log('click');
	let click = {'x': e.clientX - canvasRect.x, 'y': canvas.height - (e.clientY - canvasRect.y)};
	let point = coordsInPoint(click);
	let type = null;

	if (sys.status.adding) {
		type = sys.status.adding.type;
		if (sys.status.adding.type === 'fixed') {
			// type = 'fixed';
			if (point === null) {
				console.log("in fixed");
				let name = mechRemove.value === '' ? 'default' : mechRemove.value;
				addPoint(click.x, click.y, type, name);
				addToHistory();
				drawPoints();
				updateStatus('status', {'stopped': true});
				resetButtonsAndStatus(type);
			}
		} else { // any arm
			// adding 1st point
			if (sys.status.adding.order === 1) {
				console.log("adding arm 1st point");
				if (point === null) {
					// add point
					let name = mechRemove.value === '' ? 'default' : mechRemove.value;
					armFirstPoint.point = addPoint(click.x, click.y, type, name);
					armFirstPoint.existing = false;
				} else if (!(point.type === 'move' && type === 'rotor')) {
					console.log("IN", point.label, point.type);
					armFirstPoint.point = point;
					armFirstPoint.existing = true;
				} else {
					// TODO: when done adding both points (arm complete), check if at least 1 point is move or rotor
					console.log("ERROR, must add rotor to fixed point");
					//return false;
				}
				drawPoints();
				updateStatus('status', {'adding': {'type': sys.status.adding.type, 'order': 2}});
			// adding 2nd point
			} else {
				console.log("adding arm 2nd point");
				if (point === null) {
					console.log("adding to null point");
					if (!(armFirstPoint.point.type === 'move' && type === 'rotor')) {
						if (armFirstPoint.existing) {
							let name = mechRemove.value === '' ? 'default' : mechRemove.value;
							point = addPoint(click.x, click.y, type, name);
						} else {
							console.log("can't add null to null");
						}
					} else {
						console.log("FALSE, adding rotor from move to new");
						return false;
					}
				} else if (armFirstPoint.point.type === 'fixed' && type === 'rotor') {
					console.log("FALSE, adding rotor from fixed to existing");
					return false;
				} else {
					console.log("adding 2nd point to exisitng point");
				}

				if (type === 'rotor') {
					armFirstPoint.point.rotateFrom = point;
				}

				addArm(point, armFirstPoint.point);
				addToHistory();

				drawPoints();
				armFirstPoint.point = null;
				armFirstPoint.existing = null;
				updateStatus('status', {'stopped': true});
				resetButtonsAndStatus(type);
				finishAdding();
			}
		} // end any arm
	} 
});

canvas.addEventListener('mousedown', e => { 
	if (sys.status.stopped) {
		console.log('mousedown');
		mouseDown = true;
		mouseDownPos = {'x': e.clientX - canvasRect.x, 'y': canvas.height - (e.clientY - canvasRect.y)};
		let point = coordsInPoint(mouseDownPos);

		if (point != null) {
			if (sys.activePoint.point === null && sys.hoverPoint.point != null) {
				console.log("selecting point");
				updateStatus('activePoint', {'point': point.label, 'status': 'selected'});
				old_inst = inst.innerHTML;
				inst.innerHTML = "Point: " + point.label + " selected";
				updateTable();
			} else if (sys.activePoint.point === point.label) {
				console.log("selecting same point to unselect");
				updateStatus('activePoint', {'point': null, 'status': null});
				inst.innerHTML = old_inst;
				//tableWhite();
				updateTable();
			} else { 
				console.log("selecting to new point");
				updateStatus('activePoint', {'point': point.label, 'status': 'selected'});
				inst.innerHTML = "Point: " + point.label + " selected";
				tableWhite();
				updateTable();
			}
		} else if (sys.activePoint.point != null) {
			console.log("unselecting");
			updateStatus('activePoint', {'point': null, 'status': null});
			updateTable();
		}
	}
});

canvas.addEventListener('mouseup', e => { 
	if (sys.status.stopped) {
		if (sys.activePoint.status === 'moving') {
			console.log("stopped moving");
			updatePoint(sys.activePoint.point, mouse.x, mouse.y);
			addToHistory();
			updateStatus('activePoint', {'point': null, 'status': null});
			updateTable();
			inst.innerHTML = old_inst;
		}
	}
	mouseDown = false; 
	mouseDownPos = null;
	drawPoints();
});

/********************************************
 *
 * Mech assembly 
 *
********************************************/
let points = {};
let pointsArr = [];
let history = [];
let iteration = -1;
let currentHistory = -1;
let fixed = [];
let moves = []; // holds the points to be rotated
let arms = {};
var jensen = [];

function addPoint(x, y, type, name) {
	let newPoint = new Point(x, y, pointsArr.length, type, name);
	pointsArr.push(newPoint);
	if (pointsArr.length === 1) enableRemoveMechButton(name);
	if (type === 'rotor') {
		rotor = newPoint;
		if (armFirstPoint.point != null) {
			newPoint.rotateFrom = armFirstPoint.point;
		}
	} else if (type === 'fixed') {
		fixed.push(newPoint);
	} else {
		moves.push(newPoint);
	}
	updateTable(newPoint);
	return newPoint;
}

function addArm(pnt1, pnt2) {
	let arm = new Arm(pnt1, pnt2);
	arms[arm.label] = arm;

	if (pnt2.a) {
		if (pnt2.b) {
			console.log("WARNING: Second point", pnt2.label, "already has from A and from B");
		} else {
			// updating point1.b
			pnt2.b = pnt1;
			pnt2.bArm = arm.label;
		}
	} else {
		// updating point1.a
		pnt2.a = pnt1;
		pnt2.aArm = arm.label;
	}

	if (pnt1.a) {
		if (pnt1.b) {
			console.log("WARNING: First point", pnt1.label, "already has from A and from B");
		} else {
			// updating point.b
			pnt1.b = pnt2;
			pnt1.bArm = arm.label;
		}
	} else {
		// updating point.a
		pnt1.a = pnt2;
		pnt1.aArm = arm.label;
	}
	return arm.label;
}

function handleUpdatePoint(pointLabel) {
	// Get x coord
	let x = parseInt(document.getElementById(pointLabel+".x").value);
	let y = parseInt(document.getElementById(pointLabel+".y").value);
	updatePoint(pointLabel, x, y);
	addToHistory();
}

function updatePoint(pointLabel, x, y) {
	pointsArr[pointLabel].x = x;
	pointsArr[pointLabel].y = y;
	if (pointsArr[pointLabel].analyze) {
		oldPaths.push(paths[pointLabel]);
		paths[pointLabel] = [];
	}
	Object.keys(arms).forEach(arm => { arms[arm].calcLen(); });
	drawPoints();
	updateTable();
}

function handleNavHistory(e) {
	if (e.srcElement.id === 'undo') {
		navHistory();
	} else {
		navHistory(false);
	}
}

function navHistory(back = true) {
	if (back && iteration >= 0) {
	// if (back && currentHistory >= 0) {
		console.log("going back");
		iteration -= 1;
		if (iteration >= 0) {
			// Remove existing mech
			removeMech(mechRemove.value);
			mechFromArr(history[iteration], mechRemove.value);
		} else if (mechRemove.style.display === 'block') {
			handleRemoveMech();
		}
		drawPoints(); 
		updateTable();
		// enable forward since we just went back
		redo.disabled = false;
		// disable undo if at very beginning
		if (iteration < 0) undo.disabled = true;
	} else if (iteration < (history.length - 1)) {
	// } else if (currentHistory < (history.length - 2)) {
		console.log("going forward");
		iteration += 1;
		// currentHistory += 1;
		// disable redo if at end of history
		if (iteration >= (history.length - 1)) redo.disabled = true;
		// if (currentHistory >= (history.length - 2)) redo.disabled = true;
		// enable undo if moving beyond very beginning
		if (iteration >= 0) undo.disabled = false;
		// if (currentHistory >= 0) undo.disabled = false;
		// load point x,y for all points at currentHistory
		removeMech(mechRemove.value);
		mechFromArr(history[iteration], mechRemove.value);
		// mechFromArr(history[currentHistory+1], mechRemove.value);
		drawPoints(); 
		updateTable();
	}
}

function removePoint(pointLabel) {
	pointsArr.forEach((pnt, ind, obj) => {
		if (pnt.a != null) {
			if (pnt.a.label === pointLabel) {
				console.log("removing pnt.a");
				pnt.a = null;
				pnt.aArm = null;
			}
		}

		if (pnt.b != null) {
			if (pnt.b.label === pointLabel) {
				console.log("removing pnt.a");
				pnt.b = null;
				pnt.bArm = null;
			}
		} 

		if (pnt.label === pointLabel) {
			console.log("removing the point itself");
			// Delete arms
			Object.keys(arms).forEach(key => {
				if (arms[key].pntA.label === pointLabel) {
					delete arms[key];
				} else if (arms[key].pntB.label === pointLabel) {
					delete arms[key];
				}
			});
			// remove from rotor, fixed, ore moves arrays
			if (pnt.type === "rotor") {
				rotor = null;
			} else if (pnt.type === "fixed") {
				fixed.forEach((fix, ind1, obj1) => {
					if (fix.label === pnt.label) {
						obj1.splice(ind1, 1);
					}
				});
			} else {
				moves.forEach((move, ind2, obj2) => {
					if (move.label === pnt.label) {
						obj2.splice(ind2, 1);
					}
				});
			}
			// remove from pointsArr
			obj.splice(ind, 1);
		}
	});
	// Update the pointsArr AND labels with the new order
	pointsArr.forEach((pnt, ind) => {
		if (pnt.label != ind) {
			pnt.label = ind;
		}
	});
	if (sys.activePoint.point === pointLabel) {
		sys.activePoint.point = null;
	}
	drawPoints();
	updateTable();
}

function removeMech(name = 'default') {
	// get index in pointsArr (because it is changing)
	pointsArr.forEach((point, index, obj) => {
		if (point.mechName === name) {
			console.log("removing mech point");
			delete arms[point.aArm];
			delete arms[point.bArm];
			if (point.type === "rotor") {
				rotor = null;
			} else if (point.type === "fixed") {
				fixed.forEach((fix, ind1, obj1) => {
					if (fix.label === point.label) {
						obj1.splice(ind1, 1);
					}
				});
			} else {
				moves.forEach((move, ind2, obj2) => {
					if (move.label === point.label) {
						obj2.splice(ind2, 1);
					}
				});
			}
			obj[index] = null;
		} else {
			console.log("point.mechName:", point.mechName, "name:", name);
		}
	});
	deletePointsArrNulls();
	drawPoints();
	updateTable();
}

function deletePointsArrNulls() {
	let done = false;
	while (!done) {
		let hasNull = false;
		pointsArr.forEach((p, i, o) => {
			if (p === null) {
				hasNull = true;
				o.splice(i, 1);
			}
		});
		if (!hasNull) {
			done = true;
		}
	}
}

function loadMech(e) {
	let name = e.srcElement[e.srcElement.selectedIndex].value;
	console.log(name);
	mechFromArr(JSON.parse(savedMechs[name]), name);
	addToHistory();
	enableRemoveMechButton(name);
}

function mechFromArr(newMech, name) {
	let mechs = [];
	// Create poins
	newMech.forEach(mech => {
		let pnt = addPoint(mech.x, mech.y, mech.type, name);
		mechs.push(pnt.label);
		if (mech.a != null && mech.a < mechs.length) {
			addArm(pointsArr[mech.a], pnt);
		}
		if (mech.b != null && mech.b < mechs.length) {
			addArm(pointsArr[mech.b], pnt);
		}
		if (mech.type === 'rotor') {
			pnt.rotateFrom = pointsArr[mech.rotateFrom];
		}
	});

	moves.forEach(point => point.calcThings());
	drawPoints();
	updateTable();
}

// Every UI action should add to history as "current state"
// Without htting undo or redo, history[n] (where n = latest iteration) will always equal what is displayed
// Then n is just a pointer to where we are in history and should always equal what is displayed
// So - add mech -> add to history; add fixed point -> add to history; move point -> add to history
function addToHistory() {
	let histPointsArr = saveMech();
	// enable back button when first history added
	if (iteration < 0) {
		document.getElementById('history').style.display='block';
		undo.disabled = false;
	}
	iteration += 1;
	if (iteration === history.length) {
		console.log("already at end of history; can add");
		history.push(histPointsArr);
	} else if (iteration > history.length) {
		console.log("curr hist is out of sync! > len of history");
	} else {
		console.log("iteration < hist len. Means adding to middle of history. Thus creating a new branch")
		let removed = history.splice(iteration);
		console.log("removed", removed.length, "items from history");
		history.push(histPointsArr);
		// at end of history
		redo.disabled = true;
	}
}

function saveMech(asJSON = false) {
	let savedMech = [];
	pointsArr.forEach(point => {
		let pnt = {};
		pnt['x'] = point.x;
		pnt['y'] = point.y;
		pnt['a'] = point.a ? point.a.label : null;
		pnt['b'] = point.b ? point.b.label : null;
		pnt['type'] = point.type;
		pnt['rotateFrom'] = point.rotateFrom ? point.rotateFrom.label : null;
		pnt['mechName'] = point.mechName ? point.mechName: null;
		savedMech.push(pnt);
	});
	if (asJSON) {
		return JSON.stringify(savedMech);
	} else {
		return savedMech;
	}
}