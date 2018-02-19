let targetElement;
let difX, difY, initialX, initialY;
let initialUserSelect;
let activeTargetDrop;
let dragData;
let activeOptions = [];
let observers = {};
let compiledMatchs = {};
let grid = [1,1];

export default {
    /**
     * @param {String} id 
     * @param {Object} options = {
     *      match: '',
     *      clone: true,
     *      onDragMove(event){},
     *      onDragStart(event){},
     *      onDragEnd(event){},
     *      onDrop(event){},
     *      onDropExit(){}
     *  }
     */
    observe(id, options = {}) {
        observers[id] = options;
    },
    unobserve(id){
        delete (observers[id]);
    }
};

function round(p, n) {
    return p % n < n / 2 ? p - (p % n) : p + n - (p % n);
}

function checkMatch(element, match){
    let a, def;

    if (match){
        def = compiledMatchs[match];

        if (!def){
            compiledMatchs[match] = def = {};
            if (match[0] == '['){
                def.type = 'attribute';
                a = match.replace('[', '').replace(']', '').split('=');
                if (a.length > 1){
                    a[1] = a[1].replace(/\"/g, '');
                }
                def.name = a[0];
                def.value = a[1];
            } else if (match[0] == '.') {
                def.type = 'css';
                def.value = a.substring(1);
            }
        }

        if (def.type == 'attribute'){
            if (def.value){
                return def.value == element.getAttribute(def.name);
            } else {
                return element.hasAttribute(def.name);
            }
        } else if (def.type == 'css'){
            element.classList.contains(def.value);
        }
    }

    return true;
}

/**
 * @param {HTMLElement} element 
 * matchs válidas: [attr], [attr=value], .cls
 */
function getActiveOptions(element){
    let i, o;
    let a = [];

    for (i in observers){
        o = observers[i];
        if (checkMatch(element, o.match)){
            a.push(o);
        }
    }

    return a;
}
function dispatch(name, event = null) {
    let s = 'on' + name[0].toUpperCase() + name.substring(1);
    let fn;

    activeOptions.forEach(opt => {
        fn = opt[s];
        
        if (fn){
            fn(event);
        }
    });
}

function onMouseMove(event) {
    let rect, targetDrop, targetMouseOver, gd, x, y;
    let mouseX = event.pageX;
    let mouseY = event.pageY;
    let deslocX = event.pageX - initialX;
    let deslocY = event.pageY - initialY;
    let evt = {
        difX  : difX,
        difY  : difY,
        mouseX: mouseX,
        mouseY: mouseY,
        deslocX: deslocX,
        deslocY: deslocY,
        cancel: false,
        targetElement: targetElement
    };
    
    // encontra o target drop
    targetElement.hidden = true;
    targetDrop = targetMouseOver = document.elementFromPoint(event.pageX, event.pageY);
    targetElement.hidden = false;
    evt.target = targetDrop; // element que o mouse está dentro
    if (targetDrop){
        targetDrop = targetDrop.closest('[drop-enabled]');
        if (targetDrop){
            evt.targetDrop = targetDrop;

            // posição do mouse dentro target drop
            rect = targetDrop.getBoundingClientRect();
            evt.dropX = mouseX - rect.left;
            evt.dropY = mouseY - rect.top;
            
            // posição do mouse dentro do elemento mouseover
            rect = targetMouseOver.getBoundingClientRect();
            evt.dropChildX = mouseX - rect.left;
            evt.dropChildY = mouseY - rect.top;
        }
    }

    if (!targetElement.__drag_started) {
        lockTextSelection();

        if (targetElement.getAttribute('drag-container')!='self'){
            document.body.appendChild(targetElement);
        }
        
        targetElement.setAttribute('drag-moving', '');
        targetElement.__drag_started = true;
        dragData = {};
        gd = targetElement.parentNode.getAttribute('grid');
        if (gd){
            grid = gd.split(',');
            grid.forEach((n, i, a) => {
                a[i] = Number(n);
            });
        } else {
            grid = [1,1];
        }
        
        dispatch('dragStart', {data:dragData, target:targetElement});
    }

    x = targetElement.parentNode == document.body ? mouseX - difX : targetElement.initialOffsetLeft + deslocX; 
    y = targetElement.parentNode == document.body ? mouseY - difY : targetElement.initialOffsetTop + deslocY;
    
    x = round(x, grid[0]);
    y = round(y, grid[1]);

    dispatch('dragMove', evt);
    
    if (evt.cancel !== true) {

        // posiciona o elemento
        targetElement.style.zIndex = 9999999;
        targetElement.style.position = 'absolute';
        targetElement.style.margin = 0;
        targetElement.style.top = `${y}px`;
        targetElement.style.left = `${x}px`;
    }

    dispatch('dragAfterMove', evt);

    if (activeTargetDrop && activeTargetDrop != targetDrop){
        // saiu da drop zone
        evt.targetDrop = activeTargetDrop;
        activeTargetDrop.removeAttribute('drop-over');
        targetElement.removeAttribute('droppable');

        activeTargetDrop = null;
        dispatch('dropExit', evt, targetDrop);
    }

    if (targetDrop && targetDrop != activeTargetDrop){
        // entrou na drop zone
        targetDrop.setAttribute('drop-over', '');
        targetElement.setAttribute('droppable', '');
        activeTargetDrop = targetDrop;
        dispatch('dropEnter', evt, targetDrop);
    }

    window.dispatchEvent(new Event('resize'));
}

function onMouseUp() {
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mousemove', onMouseMove);

    restoreTextSelection();

    if (targetElement.__drag_started){
        dispatch('dragEnd');
    }

    if (activeTargetDrop){
        activeTargetDrop.removeAttribute('drop-over');
        dispatch('drop', {
            data: dragData,
            targetDrop: activeTargetDrop
        });
        activeTargetDrop = null;
    }

    targetElement.removeAttribute('drag-moving');
    targetElement.removeAttribute('droppable');
    targetElement.__drag_started = false;

    if (targetElement.__isClone && targetElement.parentNode){
        targetElement.parentNode.removeChild(targetElement);
    }

    dragData = null;
    targetElement = null;
}

function onMouseDown(event) {
    let t = event.target;
    let r;
    let evt;

    if (targetElement){
        onMouseUp();
        targetElement = null;
        activeOptions = [];
    }

    while (t.parentNode) {
        if (t.hasAttribute('drag-disabled')){
            return;
        }
        
        if (t.hasAttribute('drag-enabled')) {
            activeOptions = getActiveOptions(t);
            targetElement = t;

            r = targetElement.getBoundingClientRect();

            difX = event.pageX - r.left;
            difY = event.pageY - r.top;
            initialX = event.pageX;
            initialY = event.pageY;
            targetElement.initialOffsetLeft = targetElement.offsetLeft;
            targetElement.initialOffsetTop = targetElement.offsetTop;

            if (targetElement.getAttribute('drag-enabled') == 'clone'){
                targetElement = targetElement.cloneNode(true);
                targetElement.__isClone = true;
            }

            evt = {target:targetElement};
            dispatch('dragBeforeStart', evt);
            evt.target.__isClone = targetElement.__isClone;
            targetElement = evt.target;

            targetElement.ondragstart = function() {
                return false;
            };
            
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mousemove', onMouseMove);
            
            break;

        } else {
            t = t.parentNode;
        }

    }
}

function lockTextSelection(){
    if (initialUserSelect === undefined){
        initialUserSelect = document.body.style['user-select'];
    }
    document.body.style['user-select'] = 'none';
}

function restoreTextSelection(){
    document.body.style['user-select'] = initialUserSelect;
}

document.addEventListener('mousedown', onMouseDown);
