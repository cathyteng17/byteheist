import * as CANNON from "cannon-es";
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { Ball } from './components/objects';
import { Stats } from './components/stats';
import { Screen } from './components/screen';
import { BasicLights } from './components/lights';
import $ from "jquery";
import * as INIT from './init.js';

// EXPORTS
export var scene;
export var bitsCorrupted = 0;
export var world;

// CONSTS
const angle = (3 * Math.PI) / 180;
const renderer = new THREE.WebGLRenderer({ antialias: true });
const timeStep = 1 / 60;
const viewOffset = new CANNON.Vec3(0, 6, 0);
const groundMeshes = [];
const groundBodies = [];
const boxMeshes = [];
const boxBodies = [];
const bitlist = INIT.initBits();
const bounding_boxes = [];

// VARS
var controls;
var state = "start";
var sphereDir = new THREE.Vector3(0, 0, 1);
var keyPress = {"w": 0, "a": 0, "s": 0, "d": 0, " ": 0};

// set up renderer
renderer.setSize(window.innerWidth, window.innerHeight);
const canvas = renderer.domElement;
canvas.setAttribute("display", "block");
document.body.style.margin = 0;
document.body.style.overflow = 'hidden';
document.body.appendChild(canvas);

// jquery
$('body').css('font-family',"monospace");
// stats
const stats = new Stats(20*1000);
// screen
const screen = new Screen();

scene = new THREE.Scene();
world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -20, 0)
});

// lights
const lights = new BasicLights();
scene.add(lights);

// camera & controls
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
// https://github.com/mrdoob/three.js/blob/dev/examples/misc_controls_pointerlock.html
controls = new PointerLockControls( camera, document.body );
scene.add(controls.getObject());
camera.position.set(0, 20, -30);

// ground
const groundPhysMat = new CANNON.Material('ground');

const groundObj = INIT.initGround(100, 40, 0.2, new CANNON.Vec3(0, 0, 0));
groundMeshes.push(groundObj[0]);
groundBodies.push(groundObj[1]);
const groundObj2 = INIT.initGround(100, 40, 0.2, new CANNON.Vec3(0, 0, 50));
groundMeshes.push(groundObj2[0]);
groundBodies.push(groundObj2[1]);

for (let i = 0; i < groundMeshes.length; i++) {
  scene.add(groundMeshes[i]);
  world.addBody(groundBodies[i]);
}

// box
const boxPhysMat = new CANNON.Material('box');
const boxObj = INIT.initBox(20, 1, 5, new CANNON.Vec3(0, 2.5, 0));
boxMeshes.push(boxObj[0]);
boxBodies.push(boxObj[1]);

for (let i = 0; i < boxMeshes.length; i++) {
  scene.add(boxMeshes[i]);
  world.addBody(boxBodies[i]);
}

// VIRUS
const sphereMesh = new Ball();
scene.add(sphereMesh);

const spherePhysMat = new CANNON.Material('virus');

const radius = 2;
const sphereBody = new CANNON.Body({
    mass: 2,
    shape: new CANNON.Sphere(radius),
    position: new CANNON.Vec3(0, 10, 0),
    material: spherePhysMat,
    linearDamping: 0.5,
    angularDamping: 0.5
});
world.addBody(sphereBody);

// contact materials
const groundSphereContactMat = new CANNON.ContactMaterial(
    groundPhysMat,
    spherePhysMat,
    {restitution: 0.1, friction: 0.7} // bounce factor
);
world.addContactMaterial(groundSphereContactMat);

const boxSphereContactMat = new CANNON.ContactMaterial(
    boxPhysMat,
    spherePhysMat,
    {restitution: 0.1, friction: 0.7} // bounce factor
);
world.addContactMaterial(boxSphereContactMat);

// bounding boxes for jumping on objects
for (const body of boxBodies) {
  bounding_boxes.push(body.aabb.upperBound.y + 0.2)
}
for (const body of groundBodies) {
  bounding_boxes.push(body.aabb.upperBound.y + 0.2)
}

function updateCamera() {
    let negDirection = sphereDir.clone().normalize().negate();
    negDirection = negDirection.multiplyScalar(30);
    let destination = sphereMesh.position.clone().add(negDirection);
    camera.position.set(
      destination.x,
      sphereMesh.position.y + 20,
      destination.z
    );
    camera.lookAt(sphereMesh.position.clone().add(viewOffset));
  }

function move() {
    let impulseVec = new CANNON.Vec3(sphereDir.x, 0, sphereDir.z);
    impulseVec.scale(10);

    for (const key in keyPress) {
        if (keyPress[key] == 1) {
            switch (key) {
              case "w": // forward
                sphereBody.applyImpulse(impulseVec);
                break;
              case "s": // backward
                sphereBody.applyImpulse(impulseVec.negate());
                break;
              case "d": // right
                sphereDir.applyEuler(new THREE.Euler(0, -angle, 0));
                updateCamera();
                break;
              case "a": // left
                sphereDir.applyEuler(new THREE.Euler(0, angle, 0));
                updateCamera();
                break;
              case " ": // jump
                if (Math.abs(sphereBody.velocity.y) <= 0.001){
                    sphereBody.applyImpulse(
                        new CANNON.Vec3(0, 40, 0),
                        );
                    break;
                }
            break;
            }
        }
    }
}

function animate() {
    world.step(timeStep);

    for (let i = 0; i < groundMeshes.length; i++) {
      groundMeshes[i].position.copy(groundBodies[i].position);
      groundMeshes[i].quaternion.copy(groundBodies[i].quaternion);
    }

    for (let i = 0; i < boxMeshes.length; i++) {
      boxMeshes[i].position.copy(boxBodies[i].position);
      boxMeshes[i].quaternion.copy(boxBodies[i].quaternion);
    }

    sphereMesh.position.copy(sphereBody.position);
    sphereMesh.quaternion.copy(sphereBody.quaternion);

    for (let i = 0; i < bitlist.length; i++){
      bitsCorrupted += bitlist[i].handleCollisions(sphereMesh.position);
    }

    if (controls.isLocked) {
      move();
      stats.update(bitsCorrupted);
    }
    updateCamera();

    // reset if you fall off
    if (sphereMesh.position.y < -40) {
        sphereBody.position = new CANNON.Vec3(0, 10, 0);
        sphereMesh.position.copy(sphereBody.position);
        sphereBody.velocity = new CANNON.Vec3(0, 0, 0);
        sphereBody.quaternion = sphereBody.initQuaternion;
        sphereMesh.quaternion.copy(sphereBody.quaternion);
        for (let i = 0; i < groundMeshes.length; i++) {
          groundBodies[i].position = groundBodies[i].initPosition;
          groundMeshes[i].position.copy(groundBodies[i].position);
        }
        sphereBody.angularVelocity = new CANNON.Vec3(0, 0, 0);
        sphereDir = new THREE.Vector3(0, 0, 1);
        updateCamera();
    }

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", function(event) {
  for (var key in keyPress) {
    if (event.key == key) keyPress[key] = 1;
  }
});

window.addEventListener("keyup", function(event) {
  for (var key in keyPress) {
    if (event.key == key) keyPress[key] = 0;
  }
});

window.addEventListener("click", function() {
  if (!controls.isLocked) {
    controls.lock();
  }
});
controls.addEventListener('lock', function () {
  screen.hidePause();
  screen.hideTitle();
  if (state == "start") {
    stats.timer.start(stats.timeToElapse);
    state = "play";
  } else if (state == "play") {
    stats.timer.resume();
  } else if (state == "gameover") {
    state = "start";
  }
});
controls.addEventListener('unlock', function () {
  if (state == "play") {
    screen.showPause();
    stats.timer.pause();
  } else if (state == "gameover") {
    screen.showEnd();
  }
} );
stats.timer.on('done', () => {
  controls.unlock();
  state = "gameover";
  // need to do restart
});