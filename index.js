"use strict";
(function () {

  window.addEventListener("load", init);
  var darkMode;

  function init() {
    handleDarkModePreference();
    setTimeout(() => document.body.classList.add("do-transition"), 10);
    // We wait to give the body transition styles so that the styles
    // don't flash dark or light theme before stored preferences kick in.
    addButtonOnClick("dark-mode-toggle", toggleDarkMode);
    addButtonOnClick("light-mode-toggle", toggleDarkMode);

    // MAGIC TEXT
    const numStarsPerText = 3;
    const starAnimInterval = 1000; // ms
    initializeMagicStars(numStarsPerText, starAnimInterval);
    window.onfocus = () => initializeMagicStars(numStarsPerText, starAnimInterval);

    createCalculator();
  }

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

    // We only want to allow digits and at most one "." or "-", also the "-" must be at the start.
    const numberRegex = /^-?\d*\.?\d*$/;
    createInputFilter(calculatorInput, (value) => { return numberRegex.test(value) });

    // NUMBER INPUT
    const numberButtons = document.querySelectorAll(".calculator-button.number");
    numberButtons.forEach(button => {
      button.addEventListener("click", () => {
        calculatorInput.value = calculatorInput.value + button.textContent.charAt(0);
      });
    });

    // CLEARING
    const clearCalculator = () => {
      calculatorInput.value = "";
      calculatorHistory.innerText = "";
      pendingOperation = null;
    };
    addCalculatorOperation(calculatorInput, "clear-btn", "Escape", clearCalculator);

    // TOGGLE SIGN
    addButtonOnClick("sign-btn", () => {
      if (calculatorInput.value.startsWith("-")) {
        calculatorInput.value = calculatorInput.value.slice(1);
      } else {
        calculatorInput.value = "-" + calculatorInput.value;
      }
    });

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
        if (pendingOperation) {
          const result = getComputationResult(pendingOperation, calculatorInput, calculatorHistory);
          if (!result) return;
          calculatorInput.value = result.inputResult;
        }

        calculatorHistory.innerText = calculatorInput.value + " " + operationVisual;
        pendingOperation = operationType;
        calculatorInput.oldValue = ""; // Kind of hack-y, we are using the fact that the input filter will reject the value to clear the input
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
      addCalculatorOperation(calculatorInput, operations[i].button, operations[i].type, handleOperation);
    }

    // COMPUTATION
    addCalculatorOperation(calculatorInput, "equals-btn", "Enter", () => {
      const result = getComputationResult(pendingOperation, calculatorInput, calculatorHistory);
      if (!result) return;
      
      pendingOperation = null;
      calculatorInput.value = result.inputResult;
      calculatorHistory.innerText = result.displayHistory;
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
      });
    });
  }

  function getComputationResult(pendingOperation, calculatorInput, calculatorHistory) {
    if (!pendingOperation) {
      return;
    }

    const stripNonNumber = /[^\d.-]/g; // Matches anything that isn't a number, "-" or "." character.
    const firstNum = parseFloat(calculatorHistory.innerText.replace(stripNonNumber, ""));
    const secondNum = parseFloat(calculatorInput.value.replace(stripNonNumber, ""));

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

    return {
      inputResult: computedValue, // TODO: Could integrate .toExponential() for scientific notation in larger numbers??
      displayHistory: `${firstNum} ${pendingOperation} ${secondNum} =`,
    }
  };

  /**
   * Clears all existing magic star elements, then gives each
   * magic text element new magic stars. 
   * 
   * @param {number} numStarsPerText The number of stars for each magic text element. 
   * @param {number} starAnimInterval The total animation duration from the first star appearing to the last.
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
    if (darkMode) {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
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
   * @param {HTMLElement} calculatorInput Reference to the calculator input.
   * @param {string} buttonId The id of the button on the calculator.
   * @param {string} operationKey The string name for the corresponding key on the keyboard.
   * @param {(evt: Event) => any} operationCallback The calculator operation function to trigger.
   */
  function addCalculatorOperation(calculatorInput, buttonId, operationKey, operationCallback) {
    addButtonOnClick(buttonId, operationCallback);
    calculatorInput.addEventListener("keydown", (event) => {
      if (event.key === operationKey) {
        operationCallback(event);
        doButtonPressVisual(buttonId);
      }
    });
  }

})();