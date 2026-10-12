let activeGamepadIndex = null;
let previousButtonStates = [];
let previousAxisStates = [];

const AXIS_DEADZONE = 0.15;
const AXIS_CHANGE_THRESHOLD = 0.05;
const TRIGGER_DEADZONE = 0.05; // Prevents floating values when resting fingers on L2/R2

window.addEventListener("gamepadconnected", (e) => {
    activeGamepadIndex = e.gamepad.index;
    const gp = e.gamepad;
    
    previousButtonStates = new Array(gp.buttons.length).fill(0);
    previousAxisStates = new Array(gp.axes.length).fill(0);
    
    console.log(`Gamepad connected: ${gp.id}`);
});

window.addEventListener("gamepaddisconnected", (e) => {
    if (e.gamepad.index === activeGamepadIndex) {
        activeGamepadIndex = null;
        previousButtonStates = [];
        previousAxisStates = [];
        console.log("Gamepad disconnected");
    }
});

function pollGamepads() {
    const gamepads = navigator.getGamepads();
    if (activeGamepadIndex !== null && gamepads[activeGamepadIndex]) {
        const gp = gamepads[activeGamepadIndex];
        
        // 1. Process Buttons & Triggers
        gp.buttons.forEach((button, index) => {
            // Check if this button is an analog trigger (Index 6: L2/LT, Index 7: R2/RT)
            const isTrigger = (index === 6 || index === 7);
            
            if (isTrigger) {
                let val = button.value < TRIGGER_DEADZONE ? 0 : button.value;
                // Only log if the trigger value changes meaningfully
                if (Math.abs(val - previousButtonStates[index]) > 0.02) {
                    console.log(`Trigger ${index === 6 ? 'L2/LT' : 'R2/RT'}: ${val.toFixed(2)}`);
                    previousButtonStates[index] = val;
                }
            } else {
                // Standard digital button debouncing
                const isPressed = button.pressed;
                if (isPressed !== (previousButtonStates[index] > 0)) {
                    if (isPressed) {
                        console.log(`Button ${index} Pressed`);
                    } else {
                        console.log(`Button ${index} Released`);
                    }
                    previousButtonStates[index] = isPressed ? 1 : 0;
                }
            }
        });
        
        // 2. Process Analog Sticks (Axes)
        gp.axes.forEach((axisVal, index) => {
            const cleanedVal = Math.abs(axisVal) < AXIS_DEADZONE ? 0 : axisVal;
            const prevVal = previousAxisStates[index];
            
            if (Math.abs(cleanedVal - prevVal) > AXIS_CHANGE_THRESHOLD) {
                console.log(`Axis ${index}: ${cleanedVal.toFixed(2)}`);
                previousAxisStates[index] = cleanedVal;
            }
        });
    }
    requestAnimationFrame(pollGamepads);
}

requestAnimationFrame(pollGamepads);