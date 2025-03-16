// ==================================================================================================
// ==== Classes =====================================================================================
// ==================================================================================================

type dimensions = {
  height: number
  width: number
}

type molFormula = {
  formula: string
  molCoeff: number
}

class Vector {
  x: number;
  y: number;

  constructor(x: number = 1, y: number = 1) {
    this.x = x;
    this.y = y;
  }

  getCopy(): Vector {
    return new Vector(this.x, this.y)
  }

  getMagnitude(): number {
    return Math.sqrt((this.x**2) + (this.y**2))
  }

  getScaled(scaler: number): Vector {
    return new Vector(scaler * this.x, scaler * this.y)
  }

  getNeg(): Vector {
    return this.getScaled(-1)
  }

  getAddition(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y)
  }

  getDifference(other: Vector): Vector {
    return new Vector(other.x - this.x, other.y - this.y);
  }

  getNormalized(): Vector {
    const mag = this.getMagnitude();
  
    // Return <0,0> if input is zero vector
    if (mag === 0) {
      return new Vector(0, 0);
    }
  
    return new Vector(this.x / mag, this.y / mag);
  }

  // Input: angle in radians
  getRotated(theta: number): Vector {
    const x = this.x * Math.cos(theta) - this.y * Math.sin(theta);
    const y = this.x * Math.sin(theta) + this.y * Math.cos(theta);

    return new Vector(x, y);
  }
}


class Particle {
  formula: string
  color: string
  radius: number

  pos: Vector
  vel: Vector

  temperature: number

  state: "active" | "cooldown" | "removed" = "active";
  cooldownDist: number = 0;

  constructor(formula: string, color: string, radius: number, pos: Vector, temperature: number, vel: Vector = new Vector(0, 0)) {
    this.formula = formula
    this.color = color
    this.radius = radius
    this.pos = pos
    this.vel = vel
    this.temperature = temperature
  }
  
  // Changes temp of particle, while keeping speed-temp ratio constant
  changeTemperature(temperature: number): void {
    // Ignore if current temperature is 0 
    if (this.temperature === 0) {
      return
    }

    const speedScaler = this.vel.getMagnitude() / this.temperature

    // Create velocity at new temp, with same speed variation as original
    const newVel = this.vel.getNormalized().getScaled(speedScaler * temperature)

    this.vel = newVel
    this.temperature = temperature
  }

  update(canvas: dimensions): void {
    const newVel: Vector = this.vel.getCopy()
    const newPos: Vector = this.pos.getAddition(this.vel)

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

    // Reduce cooldown distance
    if (this.cooldownDist > 0) {
      this.cooldownDist -= this.vel.getMagnitude();
    }

    // Set active if cooldown ends
    if (this.cooldownDist <= 0 || this.state === "active") {
      this.cooldownDist = 0;
      this.state = "active"
    }
  }

  draw(context: any) {
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

    context.fillText(this.formula, this.pos.x, this.pos.y)
  }
}


class Reaction {
  name: string
  reactants: molFormula[]
  products: molFormula[]

  reversible: boolean

  constructor(name: string, reactantList: molFormula[], productsList: molFormula[], isReversible: boolean = false) {
    this.name = name
    this.reactants = reactantList
    this.products = productsList

    this.reversible = isReversible
  }

  getFormula(): string {
    let output = "";

    // Reactants
    for (const reactant of this.reactants) {
      output += reactant.molCoeff.toString() + reactant.formula + " + ";
    }

    // Single/double arrow
    output = output.substring(0, output.length-2);
    if (this.reversible) {
      output += "-> ";
    }
    else {
      output += "<=> "
    }

    // Products
    for (const product of this.products) {
      output += product.molCoeff.toString() + product.formula + " + ";
    }

    return output.substring(0, output.length-2);
  }


  // Returns list of consumed particles if rxn successful, returns null if unsuccessful
  getFwdConsumedParticles(intersectingParticles: Particle[]): null | Particle[] {
    const consumedParticles: Particle[] = [];

    for (const molFormula of this.reactants) {
      const formula = molFormula.formula;
      const minAmount = molFormula.molCoeff;

      // List of particles that are available and has correct formula
      const matchingParticles = intersectingParticles.filter(function(particle) {
        return (particle.state === "active" && particle.formula === formula)
      })

      // Return false if not enough of species
      if (matchingParticles.length < minAmount) {
        return null
      }
      
      // Consume proper amount of particles
      consumedParticles.push(...intersectingParticles.splice(0, minAmount))
    }

    return consumedParticles
  }

  getFwdProducedParticles(reactionLocation: Vector, temperature: number): Particle[] {
    const producedParticles: Particle[] = []

    for (const molFormula of this.products) {
      const formula = molFormula.formula;
      const coeff = molFormula.molCoeff;

      for (let i = 0; i < coeff; i++) {
        producedParticles.push(createParticle(formula, reactionLocation, temperature, COOLDOWN_DIST))
      }
    }

    return producedParticles
  }

  // Returns list of consumed particles if rxn successful, returns null if unsuccessful
  getRevConsumedParticles(intersectingParticles: Particle[]): null | Particle[] {
    const consumedParticles: Particle[] = [];

    for (const molFormula of this.products) {
      const formula = molFormula.formula;
      const minAmount = molFormula.molCoeff;

      // List of particles that are available and has correct formula
      const matchingParticles = intersectingParticles.filter(function(particle) {
        return (particle.state === "active" && particle.formula === formula)
      })

      // Return false if not enough of species
      if (matchingParticles.length < minAmount) {
        return null
      }
      
      // Consume proper amount of particles
      consumedParticles.push(...intersectingParticles.splice(0, minAmount))
    }

    return consumedParticles
  }

  getRevProducedParticles(reactionLocation: Vector, temperature: number): Particle[] {
    const producedParticles: Particle[] = []

    for (const molFormula of this.reactants) {
      const formula = molFormula.formula;
      const coeff = molFormula.molCoeff;

      for (let i = 0; i < coeff; i++) {
        producedParticles.push(createParticle(formula, reactionLocation, temperature, COOLDOWN_DIST))
      }
    }

    return producedParticles
  }


  // Attepts both fwd and rev rxns, returns products if successful
  attemptReaction(intersectingParticles: Particle[], particleCreationQueue: Particle[], temperature: number): boolean {

    // Attempt forward reaction
    const fwdConsumed = this.getFwdConsumedParticles(intersectingParticles)
    if (fwdConsumed !== null) {
      // Remove consumed particles      
      removeParticles(fwdConsumed)

      // Add produced particles
      particleCreationQueue.push(...this.getFwdProducedParticles(getAvgPos(fwdConsumed), temperature))

      return true
    }

    // Attempt reverse reaction if reversible (fwd failed)
    const revConsumed = this.getRevConsumedParticles(intersectingParticles)
    if (this.reversible && revConsumed !== null) {
      // Remove consumed particles      
      removeParticles(revConsumed)

      // Add produced particles
      particleCreationQueue.push(...this.getRevProducedParticles(getAvgPos(revConsumed), temperature))

      return true
    }

    return false
  }

}

// ==== MATH FUNCTIONS ==================================

function getDist(pos1: Vector, pos2: Vector): number {
  return Math.sqrt((pos1.x - pos2.x)**2 + (pos1.y - pos2.y)**2);
}

function getRandFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// Random integer from min to max inclusive
function getRandInt(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCursorPosition(event: any): Vector {
  const x = event.clientX - canvas.getBoundingClientRect().left;
  const y = event.clientY - canvas.getBoundingClientRect().top;
  return new Vector(x, y);
}


// ==== SIM FUNCTIONS ==================================

function getParticleColor(formula: string): string {
  const COLOR_MAP = formulaColorMap;
  const DEFAULT = "black";

  if (formula in COLOR_MAP) {
    return COLOR_MAP[formula];
  }
  return DEFAULT;
}

function getRandPos(dimensions: dimensions): Vector {
  return new Vector(getRandInt(0, dimensions.width), getRandInt(0, dimensions.height))
}

function createParticle(formula: string, pos: Vector, temperature: number, cooldownDist: number = 0): Particle {
  const speedVec = new Vector(temperature, 0)
  const speedScaler = getRandFloat(1 - MAX_SPEED_SCALER, 1 + MAX_SPEED_SCALER) // Randomize speed
  const angle = getRandFloat(0, 2*Math.PI)

  const particle = new Particle(formula, getParticleColor(formula), RADIUS, pos, temperature, speedVec.getScaled(speedScaler).getRotated(angle))
  if (cooldownDist !== 0) {
    particle.state = "cooldown"
    particle.cooldownDist = cooldownDist  
  }

  return particle
}

// Sets list of particles as "removed" state
function removeParticles(particles: Particle[]): void {
  for (const particle of particles) {
    particle.state = "removed"
  }
}

function changeTemperature(particles: Particle[], temperature: number): void {
  containerTemperature = temperature;
  for (const particle of particles) {
    particle.changeTemperature(temperature)
  }
}

function getAvgPos(particles: Particle[]): Vector {
  const length = particles.length

  // Return zero vector if list has no particles
  if (length === 0) {
    return new Vector(0, 0)
  }

  let totalX = 0
  let totalY = 0

  for (const particle of particles) {
    totalX += particle.pos.x
    totalY += particle.pos.y
  }

  return new Vector(totalX / length, totalY / length)
}

// ==== TESTING FUNCTIONS ==================================

function getAvgSpeed(particles: Particle[]): number {
  let totalSpeed = 0;
  for (const particle of particles) {
    totalSpeed += particle.vel.getMagnitude()
  }

  return totalSpeed/particles.length
}



// ==================================================================================================
// ==== Main Code ===================================================================================
// ==================================================================================================


const canvas: any = document.getElementById("myCanvas");
const ctx: any = canvas.getContext("2d");

const FPS: number = 60;
const CANVAS_DIMENSIONS: dimensions = canvas.getBoundingClientRect();

// ==== CONSTANTS ==================================

const RADIUS = 10;
const COOLDOWN_DIST = 2*RADIUS;
const MAX_SPEED_SCALER = 0.5; // Between 0 (0 variation), and 1 (100% variation)

// For color and formula name reference
const formulaColorMap: {[key: string]: string} = {
  A: "blue",
  B: "red",
  C: "orange"
}

// Others
const particleList: Particle[] = [];
const particleCreationQueue: Particle[] = []; // Particles waiting to be added
const reactionList: Reaction[] = [];

// Simulation container parameters
let containerPaused: boolean = false // Whether simulation is paused
let containerTemperature: number = 2 // Avg speed


for (let i = 0; i < 10; i++) {
  particleList.push(createParticle("A", new Vector(400, 400), containerTemperature))
}

reactionList.push(new Reaction("rxn1", [{formula: "A", molCoeff: 2}], [{formula: "B", molCoeff: 2}], true))



// ==== FRAME UPDATE ===============================

function drawFrame(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw particles
  for (const particle of particleList) {
    particle.draw(ctx);
  }
}

function updateFrame(): void{
  // Do nothing if simulation is paused
  if (containerPaused) {
    return
  }

  // Add queue particles
  particleList.push(...particleCreationQueue)
  particleCreationQueue.length = 0 // Clears queue

  // Update particles
  let i = 0;
  while (i < particleList.length) {
    const particle = particleList[i];

    // Delete particle if state is "removed"
    if (particle.state === "removed") {
      particleList.splice(i, 1);
      continue;
    }

    particle.update(canvas);
    i++;
  }

  // Check reactable collisions
  for (const particle1 of particleList) {

    // Ignore if not active
    if (particle1.state !== "active") {
      continue;
    }

    // Find intersecting and available particles
    const availableParticles = [particle1]

    for (const particle2 of particleList) {
      
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
    for (const reaction of reactionList) {
      const rxnSuccessful = reaction.attemptReaction(availableParticles, particleCreationQueue, containerTemperature)

      if (rxnSuccessful) {
        console.log("SUCCESSFUL REACTION")

        break;
      }
    }

  }

  drawFrame()

}

// Set frame rate
setInterval(updateFrame, 1000 / FPS);


canvas.addEventListener("mousedown", function (e) {
  const mousePos = getCursorPosition(e);

  const particle = createParticle("A", mousePos, containerTemperature)

  particleList.push(particle)
});



// ==================================================================================================
// ==== Testing =====================================================================================
// ==================================================================================================


// ==== TEMPERATURE SLIDER ===============================

var tempSlider: any = document.getElementById("temp-slider");

tempSlider.oninput = function() {
  const newTemp =  20*(this as any).value

  changeTemperature(particleList, newTemp)
  changeTemperature(particleCreationQueue, newTemp)
}

// ==== PAUSE BUTTON ===============================

var pauseButton: any = document.getElementById("pause-button");

pauseButton.onclick = function(){
  if (containerPaused) {
    containerPaused = false
    pauseButton.innerText = "Pause"
  }
  else {
    containerPaused = true
    pauseButton.innerText = "Unpause"
  }
}