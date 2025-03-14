// ==================================================================================================
// ==== Classes =====================================================================================
// ==================================================================================================
var Vector = /** @class */ (function () {
    function Vector(x, y) {
        if (x === void 0) { x = 1; }
        if (y === void 0) { y = 1; }
        this.x = x;
        this.y = y;
    }
    Vector.prototype.getCopy = function () {
        return new Vector(this.x, this.y);
    };
    Vector.prototype.getMagnitude = function () {
        return Math.sqrt((Math.pow(this.x, 2)) + (Math.pow(this.y, 2)));
    };
    Vector.prototype.getScaled = function (scaler) {
        return new Vector(scaler * this.x, scaler * this.y);
    };
    Vector.prototype.getNeg = function () {
        return this.getScaled(-1);
    };
    Vector.prototype.getAddition = function (other) {
        return new Vector(this.x + other.x, this.y + other.y);
    };
    Vector.prototype.getDifference = function (other) {
        return new Vector(other.x - this.x, other.y - this.y);
    };
    Vector.prototype.getNormalized = function () {
        var mag = this.getMagnitude();
        // Return <0,0> if input is zero vector
        if (mag === 0) {
            return new Vector(0, 0);
        }
        return new Vector(this.x / mag, this.y / mag);
    };
    // Input: angle in radians
    Vector.prototype.getRotated = function (theta) {
        var x = this.x * Math.cos(theta) - this.y * Math.sin(theta);
        var y = this.x * Math.sin(theta) + this.y * Math.cos(theta);
        return new Vector(x, y);
    };
    return Vector;
}());
var Particle = /** @class */ (function () {
    function Particle(formula, color, pos, temperature, vel) {
        if (vel === void 0) { vel = new Vector(0, 0); }
        this.radius = 10;
        this.state = "active";
        this.cooldown = 0;
        this.formula = formula;
        this.color = color;
        this.pos = pos;
        this.vel = vel;
        this.temperature = temperature;
    }
    // Changes temp of particle, while keeping speed-temp ratio constant
    Particle.prototype.changeTemperature = function (temperature) {
        // Ignore if current temperature is 0 
        if (this.temperature === 0) {
            return;
        }
        var speedScaler = this.vel.getMagnitude() / this.temperature;
        // Create velocity at new temp, with same speed variation as original
        var newVel = this.vel.getNormalized().getScaled(speedScaler * temperature);
        this.vel = newVel;
        this.temperature = temperature;
    };
    Particle.prototype.update = function (canvas) {
        var newVel = this.vel.getCopy();
        var newPos = this.pos.getAddition(this.vel);
        // Keep particle in bounds
        if (newPos.x - this.radius < 0) {
            newPos.x = this.radius;
            newVel.x *= -1;
        }
        if (newPos.x + this.radius > canvas.width) {
            newPos.x = canvas.width - this.radius;
            newVel.x *= -1;
        }
        if (newPos.y - this.radius < 0) {
            newPos.y = this.radius;
            newVel.y *= -1;
        }
        if (newPos.y + this.radius > canvas.height) {
            newPos.y = canvas.height - this.radius;
            newVel.y *= -1;
        }
        this.pos = newPos;
        this.vel = newVel;
        // Reduce cooldown
        if (this.cooldown > 0) {
            this.cooldown--;
        }
        // Set active if cooldown ends
        if (this.cooldown <= 0 || this.state === "active") {
            this.cooldown = 0;
            this.state = "active";
        }
    };
    Particle.prototype.draw = function (context) {
        context.beginPath();
        // Draw Circle
        context.fillStyle = this.color;
        context.arc(this.pos.x, this.pos.y, this.radius, 0, 2 * Math.PI);
        context.font = "14px Arial";
        context.fill();
        // Draw Formula
        context.textBaseline = "middle";
        context.textAlign = "center";
        context.fillStyle = "white";
        context.fillText(this.formula, this.pos.x, this.pos.y);
    };
    return Particle;
}());
var Reaction = /** @class */ (function () {
    function Reaction(name, reactantList, productsList, isReversible) {
        if (isReversible === void 0) { isReversible = false; }
        this.name = name;
        this.reactants = reactantList;
        this.products = productsList;
        this.reversible = isReversible;
    }
    Reaction.prototype.getFormula = function () {
        var output = "";
        // Reactants
        for (var _i = 0, _a = this.reactants; _i < _a.length; _i++) {
            var reactant = _a[_i];
            output += reactant.molCoeff.toString() + reactant.formula + " + ";
        }
        // Single/double arrow
        output = output.substring(0, output.length - 2);
        if (this.reversible) {
            output += "-> ";
        }
        else {
            output += "<=> ";
        }
        // Products
        for (var _b = 0, _c = this.products; _b < _c.length; _b++) {
            var product = _c[_b];
            output += product.molCoeff.toString() + product.formula + " + ";
        }
        return output.substring(0, output.length - 2);
    };
    // Returns list of consumed particles if rxn successful, returns null if unsuccessful
    Reaction.prototype.getFwdConsumedParticles = function (intersectingParticles) {
        var consumedParticles = [];
        var _loop_1 = function (molFormula) {
            var formula = molFormula.formula;
            var minAmount = molFormula.molCoeff;
            // List of particles that are available and has correct formula
            var matchingParticles = intersectingParticles.filter(function (particle) {
                return (particle.state === "active" && particle.formula === formula);
            });
            // Return false if not enough of species
            if (matchingParticles.length < minAmount) {
                return { value: null };
            }
            // Consume proper amount of particles
            consumedParticles.push.apply(consumedParticles, intersectingParticles.splice(0, minAmount));
        };
        for (var _i = 0, _a = this.reactants; _i < _a.length; _i++) {
            var molFormula = _a[_i];
            var state_1 = _loop_1(molFormula);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        return consumedParticles;
    };
    Reaction.prototype.getFwdProducedParticles = function (reactionLocation, temperature) {
        var producedParticles = [];
        for (var _i = 0, _a = this.products; _i < _a.length; _i++) {
            var molFormula = _a[_i];
            var formula = molFormula.formula;
            var coeff = molFormula.molCoeff;
            for (var i = 0; i < coeff; i++) {
                producedParticles.push(createParticle(formula, reactionLocation, temperature, COOLDOWN));
            }
        }
        return producedParticles;
    };
    // Returns list of consumed particles if rxn successful, returns null if unsuccessful
    Reaction.prototype.getRevConsumedParticles = function (intersectingParticles) {
        var consumedParticles = [];
        var _loop_2 = function (molFormula) {
            var formula = molFormula.formula;
            var minAmount = molFormula.molCoeff;
            // List of particles that are available and has correct formula
            var matchingParticles = intersectingParticles.filter(function (particle) {
                return (particle.state === "active" && particle.formula === formula);
            });
            // Return false if not enough of species
            if (matchingParticles.length < minAmount) {
                return { value: null };
            }
            // Consume proper amount of particles
            consumedParticles.push.apply(consumedParticles, intersectingParticles.splice(0, minAmount));
        };
        for (var _i = 0, _a = this.products; _i < _a.length; _i++) {
            var molFormula = _a[_i];
            var state_2 = _loop_2(molFormula);
            if (typeof state_2 === "object")
                return state_2.value;
        }
        return consumedParticles;
    };
    Reaction.prototype.getRevProducedParticles = function (reactionLocation, temperature) {
        var producedParticles = [];
        for (var _i = 0, _a = this.reactants; _i < _a.length; _i++) {
            var molFormula = _a[_i];
            var formula = molFormula.formula;
            var coeff = molFormula.molCoeff;
            for (var i = 0; i < coeff; i++) {
                producedParticles.push(createParticle(formula, reactionLocation, temperature, COOLDOWN));
            }
        }
        return producedParticles;
    };
    // Attepts both fwd and rev rxns, returns products if successful
    Reaction.prototype.attemptReaction = function (intersectingParticles, particleCreationQueue, reactionLocation, temperature) {
        // Attempt forward reaction
        var fwdConsumed = this.getFwdConsumedParticles(intersectingParticles);
        if (fwdConsumed !== null) {
            // Remove consumed particles      
            removeParticles(fwdConsumed);
            // Add produced particles
            particleCreationQueue.push.apply(particleCreationQueue, this.getFwdProducedParticles(reactionLocation, temperature));
            return true;
        }
        // Attempt reverse reaction if reversible (fwd failed)
        var revConsumed = this.getRevConsumedParticles(intersectingParticles);
        if (this.reversible && revConsumed !== null) {
            // Remove consumed particles      
            removeParticles(revConsumed);
            // Add produced particles
            particleCreationQueue.push.apply(particleCreationQueue, this.getRevProducedParticles(reactionLocation, temperature));
            return true;
        }
        return false;
    };
    return Reaction;
}());
// ==== MATH FUNCTIONS ==================================
function getDist(pos1, pos2) {
    return Math.sqrt(Math.pow((pos1.x - pos2.x), 2) + Math.pow((pos1.y - pos2.y), 2));
}
function getRandFloat(min, max) {
    return Math.random() * (max - min) + min;
}
// Random integer from min to max inclusive
function getRandInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getCursorPosition(event) {
    var x = event.clientX - canvas.getBoundingClientRect().left;
    var y = event.clientY - canvas.getBoundingClientRect().top;
    return new Vector(x, y);
}
// ==== SIM FUNCTIONS ==================================
function getParticleColor(formula) {
    var COLOR_MAP = formulaColorMap;
    var DEFAULT = "black";
    if (formula in COLOR_MAP) {
        return COLOR_MAP[formula];
    }
    return DEFAULT;
}
function getRandPos(dimensions) {
    return new Vector(getRandInt(0, dimensions.width), getRandInt(0, dimensions.height));
}
function createParticle(formula, pos, temperature, cooldown) {
    if (cooldown === void 0) { cooldown = 0; }
    var speedVec = new Vector(temperature, 0);
    var speedScaler = getRandFloat(1 - MAX_SPEED_SCALER, 1 + MAX_SPEED_SCALER); // Randomize speed
    var angle = getRandFloat(0, 2 * Math.PI);
    var particle = new Particle(formula, getParticleColor(formula), pos, temperature, speedVec.getScaled(speedScaler).getRotated(angle));
    if (cooldown !== 0) {
        particle.state = "cooldown";
        particle.cooldown = cooldown;
    }
    return particle;
}
// Sets list of particles as "removed" state
function removeParticles(particles) {
    for (var _i = 0, particles_1 = particles; _i < particles_1.length; _i++) {
        var particle = particles_1[_i];
        particle.state = "removed";
    }
}
function changeTemperature(particles, temperature) {
    for (var _i = 0, particles_2 = particles; _i < particles_2.length; _i++) {
        var particle = particles_2[_i];
        particle.changeTemperature(temperature);
    }
}
// ==== TESTING FUNCTIONS ==================================
function getAvgSpeed(particles) {
    var totalSpeed = 0;
    for (var _i = 0, particles_3 = particles; _i < particles_3.length; _i++) {
        var particle = particles_3[_i];
        totalSpeed += particle.vel.getMagnitude();
    }
    return totalSpeed / particles.length;
}
// ==================================================================================================
// ==== Main Code ===================================================================================
// ==================================================================================================
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
var FPS = 60;
var CANVAS_DIMENSIONS = canvas.getBoundingClientRect();
// ==== CONSTANTS ==================================
var COOLDOWN = 30;
var MAX_SPEED_SCALER = 0.5; // Between 0 (0 variation), and 1 (100% variation)
// For color and formula name reference
var formulaColorMap = {
    A: "blue",
    B: "red",
    C: "orange"
};
// Others
var particleList = [];
var particleCreationQueue = []; // Particles waiting to be added
var reactionList = [];
var containerTemperature = 2; // Avg speed
for (var i = 0; i < 1; i++) {
    particleList.push(createParticle("A", new Vector(400, 400), containerTemperature));
}
reactionList.push(new Reaction("rxn1", [{ formula: "A", molCoeff: 2 }], [{ formula: "B", molCoeff: 2 }], true));
// ==== FRAME UPDATE ===============================
function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw particles
    for (var _i = 0, particleList_1 = particleList; _i < particleList_1.length; _i++) {
        var particle = particleList_1[_i];
        particle.draw(ctx);
    }
}
function updateFrame() {
    drawFrame();
    // Add queue particles
    particleList.push.apply(particleList, particleCreationQueue);
    particleCreationQueue.length = 0; // Clears queue
    // Update particles
    var i = 0;
    while (i < particleList.length) {
        var particle = particleList[i];
        // Delete particle if state is "removed"
        if (particle.state === "removed") {
            particleList.splice(i, 1);
            continue;
        }
        particle.update(canvas);
        i++;
    }
    // Check reactable collisions
    for (var _i = 0, particleList_2 = particleList; _i < particleList_2.length; _i++) {
        var particle1 = particleList_2[_i];
        // Ignore if not active
        if (particle1.state !== "active") {
            continue;
        }
        // Find intersecting and available particles
        var availableParticles = [particle1];
        for (var _a = 0, particleList_3 = particleList; _a < particleList_3.length; _a++) {
            var particle2 = particleList_3[_a];
            // Ignore if same particle
            if (particle2 === particle1) {
                continue;
            }
            // Ignore if not active
            if (particle2.state !== "active") {
                continue;
            }
            // Check if particles overlap
            if (getDist(particle1.pos, particle2.pos) < particle1.radius + particle2.radius) {
                availableParticles.push(particle2);
            }
        }
        // Check available reactions
        for (var _b = 0, reactionList_1 = reactionList; _b < reactionList_1.length; _b++) {
            var reaction = reactionList_1[_b];
            var rxnSuccessful = reaction.attemptReaction(availableParticles, particleCreationQueue, particle1.pos, containerTemperature);
            if (rxnSuccessful) {
                console.log("SUCCESSFUL REACTION");
                break;
            }
        }
    }
}
// Set frame rate
setInterval(updateFrame, 1000 / FPS);
canvas.addEventListener("mousedown", function (e) {
    var mousePos = getCursorPosition(e);
    var particle = createParticle("A", mousePos, containerTemperature);
    // const particle = new Particle("A", "blue", mousePos, new Vector(1, 0))
    particleList.push(particle);
    console.log(getAvgSpeed(particleList));
});
