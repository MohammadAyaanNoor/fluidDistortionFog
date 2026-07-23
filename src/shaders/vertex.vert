varying vec2 vUv;
void main()
{
    // vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    // gl_Position = projectionMatrix * modelViewPosition;

    gl_Position = vec4(position.xy, 0.0, 1.0);

    //varyings
    vUv = uv;
}