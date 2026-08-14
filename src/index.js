import triviaDatabase from "./trivia_db.js"
import initialGameState from "./game_state.js"
import { shuffle } from "./utils.js"
import chalk from "chalk"
import { select } from "@inquirer/prompts"

// string constants
const CORRECT = "correct"
const INCORRECT = "incorrect"
// int constants
const TIMER_DURATION = 2000

const gameState = initialGameState

async function showMainMenu() {
    const action = await select({
        message: "Main Menu",
        choices: [
            { name: "Start Game", value: "start" },
            { name: "See Stats", value: "stats" },
            { name: "Reset Stats", value: "reset" },
            { name: "Quit", value: "quit" }
        ]
    })

    switch (action) {
        case "start":
            await startGame()
            break
        case "stats":
            showStats()
            await select({
                message: 'Select "back" to return to main menu.',
                choices: [{ name: "Back", value: "back" }]
            })
            await showMainMenu()
            break
        case "reset":
            resetStats()
            console.log(chalk.blue("\nStats have been reset.\n"))
            await showMainMenu()
            break
        case "quit":
            console.log(chalk.cyanBright("Goodbye!"))
            process.exit(0)
    }
}

// Initialize gameplay
async function startGame() {
    // make sure there are still questions left
    // (checked redundantly so that the timer warning isn't shown if there are no questions)
    await isQuestionRemaining()

    // display timer warning
    console.log(chalk.red("You only have 10 seconds to answer each question!"))
    await select({
        message: 'Select "confirm" to begin!',
        choices: [{ name: "Confirm", value: "confirm" }]
    })

    await askQuestion()
}

// Presents questions from current index
async function askQuestion() {
    // make sure there are still questions left
    await isQuestionRemaining()

    const currentQuestion = triviaDatabase[gameState.currentQuestionIndex]
    // shuffle choices into an array
    const choicesArray = shuffle([currentQuestion.correctAnswer, ...currentQuestion.wrongAnswers])
    // map choices to names, and values to correctness
    const choices = choicesArray.map((choice) => ({ name: choice, value: choice === currentQuestion.correctAnswer ? CORRECT : INCORRECT }))

// ***************************************************************** //

    const controller = new AbortController()
    const timeout = setTimeout(() => {
        controller.abort()
    }, TIMER_DURATION)

    // present question
    const answer = await select({
        message: chalk.bold(currentQuestion.question),
        choices: choices
    }, { signal: controller.signal})
        .then((answer) => answeredBehavior(answer))
        .catch((err) => {
            if (err.name === "AbortPromptError") {
                timeoutBehavior()
            } else {
                throw err
            }
        })
        .finally(() => {
            clearTimeout(timeout)
            // increment index, check for continue
            gameState.currentQuestionIndex++
            checkContinue()
        })

// ***************************************************************** //

    // ask if user wants to continue with the quiz
    // it's a function so it can be called by the timer expiration as well
    async function checkContinue() {
        const isContinue = await select({
            message: "Continue or return to main menu?",
            choices: [
                { name: "Continue", value: "continue" },
                { name: "Main Menu", value: "menu" }
            ]
        })

        // react to continue flag
        switch (isContinue) {
            case "continue":
                await askQuestion()
                break
            case "menu":
                await showMainMenu()
                break
        }
    }

    function timeoutBehavior() {
        console.log(chalk.red.bold("\nTimer expired!"))
        console.log(chalk.yellow(`The correct answer was: ${currentQuestion.correctAnswer}`))
        // increment stat and question index
        gameState.stats.incorrectAnswers++
    }

    function answeredBehavior(answer) {
        // respond to answer, log stats
        switch (answer) {
            case CORRECT:
                console.log(chalk.green("That's right!"))
                gameState.stats.correctAnswers++
                break
            case INCORRECT:
                console.log(chalk.red("Incorrect!"))
                console.log(chalk.yellow(`The correct answer was: ${currentQuestion.correctAnswer}`))
                gameState.stats.incorrectAnswers++
                break
        }
    }
}

async function isQuestionRemaining() {
    // verify there are still questions left to be answered
    if (gameState.currentQuestionIndex >= triviaDatabase.length) {
        console.log(chalk.red.bold("No questions left!", chalk.reset.red("Returning to main menu.")))
        await showMainMenu()
    }
}

// Display game stats, including remaining questions based on current index
function showStats() {
    console.log(chalk.green(`Correct answers: ${gameState.stats.correctAnswers}`))
    console.log(chalk.red(`Incorrect answers: ${gameState.stats.incorrectAnswers}`))
    const remainingQuestions = triviaDatabase.length - gameState.currentQuestionIndex
    console.log(chalk.yellow(`Remaining questions: ${remainingQuestions}`))
}

// Reset all stats to 0
function resetStats() {
    gameState.stats.correctAnswers = 0
    gameState.stats.incorrectAnswers = 0
    gameState.currentQuestionIndex = 0
}

// Start the game!
showMainMenu(initialGameState)