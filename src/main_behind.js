// Minimal bootstrap for behind-camera court/net preview.

function mainBehind() {
    RenderBehind.init();

    function frame() {
        RenderBehind.render();
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

window.addEventListener('load', mainBehind);


