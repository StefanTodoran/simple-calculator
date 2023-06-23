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

    // CALCULATOR LOGIC
    const calculatorInput = document.getElementById("calculator-input");

    // We only want to allow digits and at most one "."
    createInputFilter(calculatorInput, (value) => { return /^\d*\.?\d*$/.test(value) });

    const numberButtons = document.querySelectorAll(".calculator-button.number");
    numberButtons.forEach(button => {
      button.addEventListener("click", () => {
        calculatorInput.value = calculatorInput.value + button.textContent.charAt(0);
      });
    });

    addButtonOnClick("clear-btn", () => {
      calculatorInput.value = "";
    });

    addButtonOnClick("decimal-btn", () => {
      if (calculatorInput.value.indexOf(".") === -1) {
        calculatorInput.value = calculatorInput.value + ".";
      }
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
    const captureEvents = ["input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop", "focusout"];
    captureEvents.forEach(eventType => {
      targetInput.addEventListener(eventType, function (e) {
        if (inputFilter(this.value)) {
          // Accepted value.

          this.oldValue = this.value;
          this.oldSelectionStart = this.selectionStart;
          this.oldSelectionEnd = this.selectionEnd;
        } else if (this.hasOwnProperty("oldValue")) {
          this.value = this.oldValue;
          this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
        } else {
          // Rejected value: nothing to restore.
          this.value = "";
        }
      });
    });
  }


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

})();