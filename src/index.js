// @ts-check

let targetElement;
let difX, difY, initialX, initialY;
let initialUserSelect;
let activeTargetDrop;
let dragData;
let activeOptions = [];
let observers = {};
let compiledMatchs = {};
let grid = [1,1];
let mouseX;
let mouseY;
let deslocX;
let deslocY;

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
    /** @type {*} */
    let def
    let a

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
                def.value = def.value.substring(1);
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
function createEvent(){
    return {
        data  : dragData,
        difX  : difX,
        difY  : difY,
        mouseX: mouseX,
        mouseY: mouseY,
        deslocX: deslocX,
        deslocY: deslocY,
        cancel: false,
        targetElement: targetElement,
        targetDrop: activeTargetDrop
    };
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
    let rect, targetDrop, targetMouseOver, gd, x, y, dropName, evt
    
    deslocX = event.pageX - initialX
    deslocY = event.pageY - initialY
    mouseX = event.pageX
    mouseY = event.pageY
    
    evt = createEvent()
    
    // encontra o target drop
    if (!targetElement.__display){
        targetElement.__display = targetElement.style.display
    }
    targetElement.style.display = 'none'
    targetDrop = targetMouseOver = document.elementFromPoint(event.pageX, event.pageY)
    targetElement.style.display = targetElement.__display
    evt.target = targetDrop // element que o mouse está dentro
    
    if (targetDrop){
        targetDrop = targetDrop.closest('[drop-enabled]')
        if (targetDrop){ 
            evt.targetDrop = targetDrop
            dropName = targetDrop.getAttribute('drop-enabled')
            
            if (targetElement.getAttribute('drop-target') && targetElement.getAttribute('drop-target') != dropName){
                evt.targetDrop = targetDrop = null
            } else {
                // posição do mouse dentro target drop
                rect = targetDrop.getBoundingClientRect()
                evt.dropX = mouseX - rect.left
                evt.dropY = mouseY - rect.top
                
                // posição do mouse dentro do elemento mouseover
                rect = targetMouseOver.getBoundingClientRect()
                evt.dropChildX = mouseX - rect.left
                evt.dropChildY = mouseY - rect.top
            }
        }
    }

    if (!targetElement.__drag_started) {
        lockTextSelection()

        if (targetElement.getAttribute('drag-container') != 'self'){
            document.body.appendChild(targetElement)
        }
        
        targetElement.setAttribute('drag-moving', '')
        targetElement.__drag_started = true
        dragData = {}
        gd = targetElement.parentNode.getAttribute('grid')
        if (gd){
            grid = gd.split(',')
            grid.forEach((n, i, a) => {
                a[i] = Number(n)
            })
        } else {
            grid = [1, 1]
        }
        
        dispatch('dragStart', {data:dragData, target:targetElement, targetOrigin: event.target})
    }

    x = targetElement.parentNode == document.body ? mouseX - difX : targetElement.initialOffsetLeft + deslocX 
    y = targetElement.parentNode == document.body ? mouseY - difY : targetElement.initialOffsetTop + deslocY
    
    x = round(x, grid[0])
    y = round(y, grid[1])

    evt.x = x
    evt.y = y

    dispatch('dragMove', evt)
    
    if (evt.cancel !== true) {

        // posiciona o elemento
        targetElement.style.zIndex = 9999999
        targetElement.style.position = 'absolute'
        targetElement.style.margin = 0
        targetElement.style.top = `${evt.y}px`
        targetElement.style.left = `${evt.x}px`
    }

    dispatch('dragAfterMove', evt)

    if (activeTargetDrop && activeTargetDrop != targetDrop){
        // saiu da drop zone
        evt.targetDrop = activeTargetDrop
        activeTargetDrop.removeAttribute('drop-over')
        targetElement.removeAttribute('droppable')

        activeTargetDrop = null
        dispatch('dropExit', evt) //, targetDrop)
    }

    if (targetDrop && targetDrop != activeTargetDrop){
        // entrou na drop zone
        targetDrop.setAttribute('drop-over', '')
        targetElement.setAttribute('droppable', '')
        activeTargetDrop = targetDrop
        dispatch('dropEnter', evt) //, targetDrop)
    }

    // window.dispatchEvent(new Event('resize'))
}

function onMouseUp() {
    let evt = createEvent();

    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('mousemove', onMouseMove);

    restoreTextSelection();

    if (targetElement.__drag_started){
        dispatch('dragEnd', evt);
    }

    if (activeTargetDrop){
        activeTargetDrop.removeAttribute('drop-over');
        dispatch('drop', evt);
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
    let t = event.target
    let r, k, o, mode, evt, _isDraggable

    if (targetElement){
        onMouseUp()
        targetElement = null
        activeOptions = []
    }

    while (t.parentNode && t != document.body) {
        if (t.hasAttribute('drag-disabled')){
            return
        }
        
        for (k in observers){
            o = observers[k]
            _isDraggable = o.isDraggable || isDraggable
            
            mode = _isDraggable(t)

            if (mode) {
                activeOptions = getActiveOptions(t)
                targetElement = t

                r = targetElement.getBoundingClientRect()

                difX = event.pageX - r.left
                difY = event.pageY - r.top
                initialX = event.pageX
                initialY = event.pageY
                targetElement.initialOffsetLeft = targetElement.offsetLeft
                targetElement.initialOffsetTop = targetElement.offsetTop

                if (mode == 'clone' || targetElement.getAttribute('drag-enabled') == 'clone'){
                    targetElement = targetElement.cloneNode(true)
                    targetElement.__isClone = true
                }

                evt = {target:targetElement}
                dispatch('dragBeforeStart', evt)
                evt.target.__isClone = targetElement.__isClone
                targetElement = evt.target

                targetElement.ondragstart = function() {
                    return false
                }
                
                document.addEventListener('mouseup', onMouseUp)
                document.addEventListener('mousemove', onMouseMove)
                
                return
            }
        }

        t = t.parentNode
    }
}

function isDraggable(node){
    return node.hasAttribute('drag-enabled')
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
