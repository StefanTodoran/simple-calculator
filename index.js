"use strict";
(function () {

  window.addEventListener("load", init);
  const maxInputLength = 25; // Make sure this matches the maxlength value in the HTML.
  var darkMode;

  /**
   * Main entry point for calculator application.
   */
  function init() {
    handleDarkModePreference();
    setTimeout(() => document.body.classList.add("do-transition"), 10);
    // We wait to give the body transition styles so that the styles
    // don't flash dark or light theme before stored preferences kick in.
    addButtonOnClick("dark-mode-toggle", toggleDarkMode);
    addButtonOnClick("light-mode-toggle", toggleDarkMode);

    const modal = document.getElementById("modal");
    addButtonOnClick("help-btn", () => modal.showModal());
    modal.addEventListener("click", () => modal.close());

    const numStarsPerText = 3;
    const starAnimInterval = 1000; // ms
    initializeMagicStars(numStarsPerText, starAnimInterval);
    window.onfocus = () => initializeMagicStars(numStarsPerText, starAnimInterval);
    // When another tab is active, setInterval is broken for intervals smaller than 1 second,
    // we do this onfocus to reset the stars so they don't become synced up.

    createCalculator();
  }

  /**
   * Creates the various event listeners and functions needed for the
   * calculator to be able to handle keyboard and mouse input and do computation.
   */
  function createCalculator() {
    const calculatorInput = document.getElementById("calculator-input");
    const calculatorHistory = document.getElementById("calculator-history");
    let pendingOperation = null;

    // We use this to focus to the input when the user starts typing.
    addEventListener("keydown", (event) => {
      const operations = ["+", "-", "*", "/", "%", "Escape", "Enter", "Backspace", ".", "^", "="];
      const isOperation = operations.includes(event.key); // The %, + and ^ end up just getting captured as 5, 6 and = if using a keyboard without number pad
      const isNumber = /^[0-9]$/i.test(event.key);

      if (isOperation || isNumber) calculatorInput.focus();
      if (isNumber) doButtonPressVisual(event.key + "-btn");
    });

    // We only want to allow digits and at most one "." or "-", also the "-" must be at the start. It should
    // match some invalid forms like "-" alone or "-." because those may be typed in the process of typing a 
    // longer valid number. In the event that doesn't happen our computation code has error handling. This 
    // also matches scientific notation numbers.
    const numberRegex = /^-?\d*(?:\.\d*)?(?:\d+[eE][+-]?\d+)?$/; // /^(?!-$)-?\d*\.?\d*$/;
    createInputFilter(calculatorInput, (value) => { return numberRegex.test(value) });

    // NUMBER INPUT
    const numberButtons = document.querySelectorAll(".calculator-button.number");
    numberButtons.forEach(button => {
      button.addEventListener("click", () => {
        if (calculatorInput.value.length < maxInputLength) {
          calculatorInput.value = calculatorInput.value + button.textContent.charAt(0);
          sizeTextFromLength(calculatorInput);
        }
      });
    });

    // CLEARING
    addCalculatorOperation("clear-btn", ["Escape"], () => {
      calculatorInput.value = "";
      calculatorHistory.innerText = "";
      pendingOperation = null;
    });

    // TOGGLE SIGN
    addButtonOnClick("sign-btn", () => {
      if (calculatorInput.value.startsWith("-")) {
        calculatorInput.value = calculatorInput.value.slice(1);
      } else if (calculatorInput.value !== "") {
        calculatorInput.value = "-" + calculatorInput.value;
      }
    });

    // DECIMALS
    addButtonOnClick("decimal-btn", () => {
      if (calculatorInput.value.indexOf(".") === -1) {
        calculatorInput.value = calculatorInput.value + ".";
      }
      doButtonPressVisual("decimal-btn");
    });

    // MATH OPERATIONS
    function createOperationCallback(operationType, operationVisual) {
      operationVisual = operationVisual || operationType;
      return (event) => {
        if (calculatorInput.value === "") return;

        if (pendingOperation) {
          const result = getComputationResult(pendingOperation, calculatorInput, calculatorHistory);
          if (!result) return;
          calculatorInput.value = result.inputResult;
        }

        calculatorHistory.innerText = calculatorInput.value + " " + operationVisual;
        pendingOperation = operationType;
        calculatorInput.value = "";
        event.preventDefault(); // So that minus "-", which is valid input, doesn't get typed after this clearing
      }
    }

    const operations = [
      { type: "%", button: "percent-btn" },
      { type: "/", button: "divide-btn", visual: "÷", },
      { type: "*", button: "multiply-btn", visual: "x", },
      { type: "-", button: "minus-btn" },
      { type: "+", button: "plus-btn" },
      { type: "^", button: "exponent-btn" },
    ];

    for (let i = 0; i < operations.length; i++) {
      const handleOperation = createOperationCallback(operations[i].type, operations[i].visual);
      addCalculatorOperation(operations[i].button, [operations[i].type], handleOperation);
    }

    // COMPUTATION
    addCalculatorOperation("equals-btn", ["Enter", "="], (event) => {
      const result = getComputationResult(pendingOperation, calculatorInput, calculatorHistory);
      if (!result) return;

      pendingOperation = null;
      if (result.error) {
        calculatorInput.value = "";
        calculatorHistory.innerText = result.error;
      } else {
        calculatorInput.value = result.inputResult;
        calculatorHistory.innerText = result.displayHistory;
      }

      sizeTextFromLength(calculatorInput);
      event.preventDefault(); // So it doesn't type the "=", which would cause our filter to kick in.
    });
  }

  /**
   * Creates several event listeners on the target element capturing various
   * methods for input include typing, pasting and drag and drop.
   * 
   * @param {HTMLElement} targetInput The input to which the filter should apply.
   * @param {(value: string) => boolean} inputFilter A function which returns true if the input is valid and false otherwise.
   */
  function createInputFilter(targetInput, inputFilter) {
    const captureEvents = ["input", "keydown", "keyup", "mouseup", "select", "contextmenu", "drop"];
    captureEvents.forEach(eventType => {
      targetInput.addEventListener(eventType, function () {
        if (inputFilter(this.value)) {
          this.oldValue = this.value;
        } else if (this.hasOwnProperty("oldValue")) {
          this.value = this.oldValue;
        } else { // Value rejected: nothing to restore.
          this.value = "";
        }
        sizeTextFromLength(targetInput);
      });
    });
  }

  /**
   * @typedef {Object} ComputationResult
   * @property {number} inputResult The resulting number to be shown in the input element.
   * @property {string} displayHistory The computation which caused the result, shown in history element.
   * @property {string} error A string error, or null in the event there is no error.
   */
  /**
   * Given the current calculator state, computes the operation and returns an
   * object representing the result.
   * 
   * @param {string} pendingOperation Should be one of "+", "-", "*", "/", "%", "^", "="
   * @param {HTMLElement} calculatorInput The calculator text input element.
   * @param {HTMLElement} calculatorHistory The calculator history element.
   * @returns {ComputationResult}
   */
  function getComputationResult(pendingOperation, calculatorInput, calculatorHistory) {
    if (!pendingOperation || calculatorInput.value === "") {
      return;
    }

    const firstNum = parseFloat(calculatorHistory.innerText);
    const secondNum = parseFloat(calculatorInput.value);

    let computedValue;
    switch (pendingOperation) {
      case "%":
        computedValue = (firstNum / 100) * secondNum;
        break;
      case "/":
        computedValue = firstNum / secondNum;
        break;
      case "*":
        computedValue = firstNum * secondNum;
        break;
      case "-":
        computedValue = firstNum - secondNum;
        break;
      case "+":
        computedValue = firstNum + secondNum;
        break;
      case "^":
        computedValue = firstNum ** secondNum;
        break;
    }

    const result = {
      inputResult: computedValue,
      displayHistory: `${firstNum} ${pendingOperation} ${secondNum} =`,
      error: null,
    }

    if (pendingOperation === "/" && secondNum === 0) result.error = "Can't divide by zero!";
    else if (!isFinite(computedValue)) result.error = "Overflow!"; // JavaScript numbers give infinity for overflow.
    if (isNaN(computedValue)) result.error = "Not a number!"; // This is intentionally after finite check, since NaN doesn't count as finite for some reason.

    return result;
  }

  /**
   * A helper function for adding click event listeners to 
   * elements, identified by id.
   * 
   * @param {string} id String id of the target element.
   * @param {(evt: Event) => any} func The function that sound trigger on click.
   */
  function addButtonOnClick(id, func) {
    document.getElementById(id).addEventListener("click", func);
  }

  /**
   * Uses css class to visually simulate an onscreen calculator button being
   * pressed. Timeout duration matches css, make sure to change both if modifiying! 
   * 
   * @param {HTMLElement} id The id of the target button. 
   */
  function doButtonPressVisual(id) {
    const button = document.getElementById(id);
    button.classList.add("pressed");
    setTimeout(() => button.classList.remove("pressed"), 200);
  }

  /**
   * Adds a click event listener to the operation button in the HTML and a keydown event
   * listener for the operation key. If activated using keyboard, handles visual for onscreen button.
   * 
   * @param {string} buttonId The id of the button on the calculator.
   * @param {string[]} operationKeys An array of string names for the corresponding keys on the keyboard.
   * @param {(evt: Event) => any} operationCallback The calculator operation function to trigger.
   */
  function addCalculatorOperation(buttonId, operationKeys, operationCallback) {
    addButtonOnClick(buttonId, operationCallback);
    addEventListener("keydown", (event) => {
      if (operationKeys.includes(event.key)) {
        operationCallback(event);
        doButtonPressVisual(buttonId);
      }
    });
  }

  function sizeTextFromLength(calculatorInput) {
    const maxLengthNoShrink = 12; // May need to be adjusted if CSS styles are changed.

    const maxFontSize = 36;
    const maxLineHeight = 36;
    const minFontSize = 18;
    const minLineHeight = 58;

    const bezierCurve = { x1: .25, y1: .8, x2: 1, y2: 1 };
    const interpolationAmount = (calculatorInput.value.length - maxLengthNoShrink) / (maxInputLength - maxLengthNoShrink);
    const interpolatedValue = 1 - cubicBezierInterpolation(interpolationAmount, bezierCurve);

    calculatorInput.style.setProperty("--text-size", progressionInterpolate(interpolatedValue, minFontSize, maxFontSize) + "px");
    calculatorInput.style.setProperty("--line-height", progressionInterpolate(interpolatedValue, minLineHeight, maxLineHeight) + "px");
  }

  /**
   * @param {number} progress An interpolation amount between 0 and 1. 
   * @param {number} minBound The lower bound for the interpolation output range. 
   * @param {number} maxBound The upper bound for the interpolation output range.
   */
  function progressionInterpolate(progress, minBound, maxBound) {
    return (maxBound - minBound) * progress + minBound;
  }

  /**
   * @typedef {Object} CubicBezier
   * @property {number} x1 Typically between 0 and 1 but can be outside that range.
   * @property {number} y1
   * @property {number} x2
   * @property {number} y2
   */
  /**
   * JavaScript version of cubic bezier interpolation, intended to mimic
   * the CSS version. Uses 1e-6 precision.
   * 
   * @param {number} time The interpolation amount, must be between 0 and 1. 
   * @param {CubicBezier} bezier An object describing the bezier curve.
   * @returns {number} The output 'progress amount', may be outside 0 to 1 range based on the curve.
   */
  function cubicBezierInterpolation(time, bezier) {
    // Ensure time is between 0 and 1
    time = Math.max(0, Math.min(1, time));

    // Extract bezier control points
    const p0 = { x: 0, y: 0 };
    const p1 = { x: bezier.x1, y: bezier.y1 };
    const p2 = { x: bezier.x2, y: bezier.y2 };
    const p3 = { x: 1, y: 1 };

    // Calculate the coefficients for the cubic bezier equation
    const cx = 3 * p1.x;
    const bx = 3 * (p2.x - p1.x) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * p1.y;
    const by = 3 * (p2.y - p1.y) - cy;
    const ay = 1 - cy - by;

    const epsilon = 1e-6; // Adjust this value to control precision
    let t2 = time;
    let x2, d2;
    for (let i = 0; i < 8; i++) {
      x2 = ((ax * t2 + bx) * t2 + cx) * t2 - time;
      if (Math.abs(x2) < epsilon) {
        return ((ay * t2 + by) * t2 + cy) * t2;
      }
      d2 = (3 * ax * t2 + 2 * bx) * t2 + cx;
      if (Math.abs(d2) < epsilon) {
        break;
      }
      t2 -= x2 / d2;
    }

    // Fallback to linear interpolation
    const slope = (p3.y - p0.y) / (p3.x - p0.x);
    return p0.y + slope * (time - p0.x);
  }

  /**
   * Returns a random float between min and max, inclusive.
   * Should be a uniform distribution.
   * 
   * @param {number} min Minimum number, inclusive.
   * @param {number} max Maximum number, also inclusive.
   * @returns {number} A float number between min and max.
   */
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Retrieves the value for a cookie key, value pair.
   * 
   * @param {string} key 
   * @returns {string} Corresponding cookie value.
   */
  function getCookieValue(key) {
    const value = document.cookie
      .split("; ")
      .find((row) => row.startsWith(key + "="))
      ?.split("=")[1];
    return value;
  }

  /**
   * Creates a cookie key value pair with the provided
   * data and an optional age parameter. Cookies are secure
   * but have SameSite value of None.
   * 
   * @param {string} key The cookie key.
   * @param {string} value The cookie value.
   * @param {number} age Number of seconds until expiration, defaults to one year.
   */
  function setCookieValue(key, value, age) {
    age = age || 31536000;
    const cookie = `${key}=${value}; max-age=${age}; SameSite=None; path=/; Secure`;
    document.cookie = cookie;
  }

  /**
   * Clears all existing magic star elements, then gives each
   * magic text element new magic stars. 
   * 
   * @param {number} numStarsPerText The number of stars for each magic text element. 
   * @param {number} starAnimInterval The total animation duration from the first star appearing to the last, given in milliseconds.
   */
  function initializeMagicStars(numStarsPerText, starAnimInterval) {
    const magicStars = document.querySelectorAll(".magic-star");
    magicStars.forEach(star => star.remove());

    const magicTextElems = document.querySelectorAll(".magic-text");
    magicTextElems.forEach(elem => {
      // For each text element, we want to create
      // the desired number of stars and start their
      // animation loops.

      for (let i = 0; i < numStarsPerText; i++) {
        setTimeout(() => {
          const star = createMagicStar();
          elem.appendChild(star);
          animateStar(star);

          setInterval(() => animateStar(star), starAnimInterval);
        }, i * (starAnimInterval / numStarsPerText));
      }
    });
  }

  /**
   * Given a single magic star element, moves it to a random
   * position on the magic text and restarts its animation.
   * 
   * @param {HTMLElement} star 
   */
  function animateStar(star) {
    star.style.setProperty("--star-left", `${randInt(-10, 110)}%`);
    star.style.setProperty("--star-top", `${randInt(5, 95)}%`);

    // We need to trigger DOM reflow to start the animation again.
    star.style.animation = "none";
    star.offsetHeight;
    star.style.animation = "";
  }

  /**
   * Simple helper function for creating a magic star.
   * 
   * @returns {HTMLImageElement} The newly created star.
   */
  function createMagicStar() {
    const star = document.createElement("img");
    star.classList.add("magic-star");
    star.src = "assets/star.svg";
    return star;
  }

  /**
   * Retrieves the user's stored dark mode preference,
   * or uses system settings if there is none.
   */
  function handleDarkModePreference() {
    if (getCookieValue("darkMode") === "true") {
      darkMode = true;
    } else if (getCookieValue("darkMode") === "false") {
      darkMode = false;
    } else {
      // If the user has no stored preference, check their system settings.
      darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    updateDarkMode();
  }

  /**
   * Used to update darkMode styles after the darkMode global var has been set.
   */
  function updateDarkMode() {
    const link = document.querySelector("link[rel~='icon']");
    if (darkMode) {
      document.body.classList.add("dark-mode");
      link.href = "assets/dark_favicon.ico";
    } else {
      document.body.classList.remove("dark-mode");
      link.href = "assets/favicon.ico";
    }
  }

  /**
   * Toggles the darkMode global variable, triggers style change, updates stored cookie preference.
   */
  function toggleDarkMode() {
    darkMode = !darkMode;
    setCookieValue("darkMode", darkMode);
    updateDarkMode();
  }

})();