"use strict";

var canvas, gl, program;

var NumVertices = 36;

var points = [];
var colors = [];
var texCoords = [];

var vertices = [
    vec4(-0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, 0.5, 0.5, 1.0),
    vec4(0.5, 0.5, 0.5, 1.0),
    vec4(0.5, -0.5, 0.5, 1.0),
    vec4(-0.5, -0.5, -0.5, 1.0),
    vec4(-0.5, 0.5, -0.5, 1.0),
    vec4(0.5, 0.5, -0.5, 1.0),
    vec4(0.5, -0.5, -0.5, 1.0)
];

var isLightOn = false;

var textureCoords = [
    vec2(0, 0), vec2(0, 1), vec2(1, 1), vec2(1, 0)
];

var BASE_HEIGHT = 0.5;
var BASE_WIDTH = 3.0;
var ARM_HEIGHT = 3.0;
var ARM_WIDTH = 0.3;
var SECOND_ARM_HEIGHT = 2.0;
var SECOND_ARM_WIDTH = 0.25;
var HEAD_HEIGHT = 2.0;
var HEAD_WIDTH = 2.0;

var Base = 0;
var Arm = 1;
var Second_arm = 2;
var Head = 3;

var theta = [0, 0, 0, 0];

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc;

var vBuffer, cBuffer, tBuffer;

init();

function quad(a, b, c, d) {
    points.push(vertices[a]);
    texCoords.push(textureCoords[0]);

    points.push(vertices[b]);
    texCoords.push(textureCoords[1]);

    points.push(vertices[c]);
    texCoords.push(textureCoords[2]);

    points.push(vertices[a]);
    texCoords.push(textureCoords[0]);

    points.push(vertices[c]);
    texCoords.push(textureCoords[2]);

    points.push(vertices[d]);
    texCoords.push(textureCoords[3]);
}

function colorCube() {
    quad(1, 0, 3, 2); // Front face
    quad(2, 3, 7, 6); // Right face
    quad(3, 0, 4, 7); // Bottom face
    quad(6, 5, 1, 2); // Top face
    quad(4, 5, 6, 7); // Back face
    quad(5, 4, 0, 1); // Left face
}

var rotatingBase = false; // Apakah base sedang berputar
var rotatingArm = false;  // Apakah arm sedang berputar

var rotationSpeedBase = 1; // Kecepatan rotasi untuk base (dalam derajat per frame)
var rotationSpeedArm = 1;  // Kecepatan rotasi untuk arm (dalam derajat per frame)

function rotateBase() {
    if (rotatingBase) {
        theta[Base] += rotationSpeedBase;
        if (theta[Base] > 360) theta[Base] -= 360;
    }
}

function rotateArm() {
    if (rotatingArm) {
        theta[Arm] += rotationSpeedArm;
        if (theta[Arm] > 360) theta[Arm] -= 360;
    }
}

function createFullSphere(radius, slices, stacks) {
    let points = [];
    for (let stack = 0; stack <= stacks; stack++) {
        let phi = (stack / stacks) * Math.PI; // Sudut vertikal (0 hingga π)
        let z = radius * Math.cos(phi);
        let r = radius * Math.sin(phi);

        for (let slice = 0; slice <= slices; slice++) {
            let theta = (slice / slices) * 2 * Math.PI; // Sudut horizontal (0 hingga 2π)
            let x = r * Math.cos(theta);
            let y = r * Math.sin(theta);

            points.push(vec4(x, y, z, 1.0));
        }
    }

    // Generate triangles
    let spherePoints = [];
    for (let stack = 0; stack < stacks; stack++) {
        for (let slice = 0; slice < slices; slice++) {
            let first = stack * (slices + 1) + slice;
            let second = first + slices + 1;

            spherePoints.push(points[first]);
            spherePoints.push(points[second]);
            spherePoints.push(points[first + 1]);

            spherePoints.push(points[second]);
            spherePoints.push(points[second + 1]);
            spherePoints.push(points[first + 1]);
        }
    }

    return spherePoints;
}

function createHalfSphere(radius, slices, stacks) {
    let points = [];
    let texCoords = [];
    for (let stack = 0; stack <= stacks; stack++) {
        let phi = (stack / stacks) * Math.PI / 2; // Hanya bagian atas (setengah bola)
        let z = radius * Math.cos(phi);
        let r = radius * Math.sin(phi);

        for (let slice = 0; slice <= slices; slice++) {
            let theta = (slice / slices) * 2 * Math.PI;
            let x = r * Math.cos(theta);
            let y = r * Math.sin(theta);

            points.push(vec4(x, y, z, 1.0));
            texCoords.push(vec2(slice / slices, stack / stacks));
        }
    }

    // Generate triangles
    let spherePoints = [];
    for (let stack = 0; stack < stacks; stack++) {
        for (let slice = 0; slice < slices; slice++) {
            let first = stack * (slices + 1) + slice;
            let second = first + slices + 1;

            spherePoints.push(points[first]);
            spherePoints.push(points[second]);
            spherePoints.push(points[first + 1]);

            spherePoints.push(points[second]);
            spherePoints.push(points[second + 1]);
            spherePoints.push(points[first + 1]);
        }
    }

    return spherePoints;
}

function init() {
    canvas = document.getElementById("gl-canvas");
    gl = canvas.getContext('webgl2');
    if (!gl) { alert("WebGL 2.0 isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    colorCube();

    // Position Buffer
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    var positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    // Texture Buffer
    tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);

    var texCoordLoc = gl.getAttribLocation(program, "aTexCoord");
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texCoordLoc);

    // Load texture
    var texture = gl.createTexture();
    var image = new Image();
    image.crossOrigin = "anonymous";
    image.src = 'darkgreytexture.jpeg'
    image.onload = function() {
        console.log("Texture loaded successfully:", image.src);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
    
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.onerror = function() {
        console.error("Failed to load texture:", image.src);
    };

    // Tombol untuk memulai atau menghentikan rotasi Base
    document.getElementById("startBase").onclick = function() {
        rotatingBase = true;  // Mulai rotasi base
        console.log("Base rotation started");
    };

    document.getElementById("pauseBase").onclick = function() {
        rotatingBase = false; // Hentikan rotasi base
        console.log("Base rotation paused");
    };


    document.getElementById("slider3").onchange = function(event) { theta[Second_arm] = event.target.value; };
    document.getElementById("slider4").onchange = function(event) { theta[Head] = event.target.value; };

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrix = ortho(-10, 10, -10, 10, -10, 10);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "projectionMatrix"), false, flatten(projectionMatrix));

    render();
}

function base() {
    var s = scale(BASE_WIDTH, BASE_HEIGHT, BASE_WIDTH);
    var instanceMatrix = mult(translate(0.0, 0.5 * BASE_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

function arm() {
    var s = scale(ARM_WIDTH, ARM_HEIGHT, ARM_WIDTH);
    var instanceMatrix = mult(translate(0.0, 0.5 * ARM_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}

function second_arm() {
    var s = scale(SECOND_ARM_WIDTH, SECOND_ARM_HEIGHT, SECOND_ARM_WIDTH);
    var instanceMatrix = mult(translate(0.0, 0.5 * SECOND_ARM_HEIGHT, 0.0), s);
    var t = mult(modelViewMatrix, instanceMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.drawArrays(gl.TRIANGLES, 0, NumVertices);
}
function toggleLight() {
    isLightOn = !isLightOn;
    document.body.classList.toggle('on');
    console.log("Light is now: " + (isLightOn ? "ON" : "OFF"));
}

function head() {
    // Setengah sphere untuk casing
    let halfSphere = createHalfSphere(HEAD_WIDTH / 2, 20, 10);
    let instanceMatrix = mult(translate(0.0, 0.0, -HEAD_WIDTH / 2), mat4());
    let t = mult(modelViewMatrix, instanceMatrix);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(t));
    gl.uniform1i(gl.getUniformLocation(program, "uUseTexture"), true);

    // Buffer untuk setengah bola
    let halfSphereBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, halfSphereBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(halfSphere), gl.STATIC_DRAW);

    let positionLoc = gl.getAttribLocation(program, "aPosition");
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    gl.drawArrays(gl.TRIANGLES, 0, halfSphere.length);

    // Bola kecil untuk bohlam
    let smallSphere = createFullSphere(HEAD_WIDTH / 4, 20, 20);
    let smallSphereMatrix = mult(t, translate(0.0, 0.0, HEAD_WIDTH / 4));
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(smallSphereMatrix));

    gl.uniform1i(gl.getUniformLocation(program, "uUseTexture"), false);
    
    // Warna bola berdasarkan status lampu
    if (isLightOn) {
        gl.uniform4fv(gl.getUniformLocation(program, "uColor"), vec4(1.0, 1.0, 0.7, 1.0)); // Putih terang
    } else {
        gl.uniform4fv(gl.getUniformLocation(program, "uColor"), vec4(0.4, 0.4, 0.4, 1.0)); // Abu-abu gelap
    }

    let smallSphereBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, smallSphereBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(smallSphere), gl.STATIC_DRAW);

    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    gl.drawArrays(gl.TRIANGLES, 0, smallSphere.length);

    // Kembalikan ke buffer asli dan aktifkan tekstur
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.vertexAttribPointer(positionLoc, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLoc);

    gl.uniform1i(gl.getUniformLocation(program, "uUseTexture"), true);
}


function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Rotasi Base jika rotasi diaktifkan
    rotateBase();
    modelViewMatrix = rotate(theta[Base], vec3(0, 1, 0));

    gl.uniform1i(gl.getUniformLocation(program, "uUseTexture"), true); // Aktifkan tekstur
    base();

    // Rotasi Arm
    rotateArm();
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, BASE_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[Arm], vec3(0, 1, 0)));
    arm();

    // Second Arm
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, ARM_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[Second_arm], vec3(0, 0, 1)));
    second_arm();

    // Head
    modelViewMatrix = mult(modelViewMatrix, translate(0.0, SECOND_ARM_HEIGHT, 0.0));
    modelViewMatrix = mult(modelViewMatrix, rotate(theta[Head], vec3(1, 0, 0)));

    head();

    requestAnimationFrame(render);
}
