package esmeta

import esmeta.phase.*
import esmeta.util.ArgParser

/** commands
  *
  * @tparam Result
  *   the result typeof command
  */
sealed abstract class Command[Result](
  /** command name */
  val name: String,

  /** phase list */
  val pList: PhaseList[Result],
) {
  override def toString: String = pList.toString

  /** help message */
  def help: String

  /** help message */
  def examples: List[String]

  /** show the final result */
  def showResult(res: Result): Unit = println(res)

  /** target name */
  def targetName: String = ""

  /** need target */
  def needTarget: Boolean = targetName != ""

  /** run command with command-line arguments */
  def apply(args: List[String]): Result =
    val cmdConfig = CommandConfig(this)
    val parser = ArgParser(this, cmdConfig)
    val runner = pList.getRunner(parser)
    parser(args)
    ESMeta(this, runner(_), cmdConfig)

  /** run command with command-line arguments */
  def apply(args: String): Result = apply(args.split(" +").toList)

  /** a list of phases without specific IO types */
  def phases: Vector[Phase[_, _]] = pList.phases

  /** append a phase to create a new phase list */
  def >>[R](phase: Phase[Result, R]): PhaseList[R] = pList >> phase
}

/** base command */
case object CmdBase extends Command("", PhaseNil) {
  val help = "does nothing."
  val examples = Nil
}

/** `help` command */
case object CmdHelp extends Command("help", CmdBase >> Help) {
  val help = "shows help messages."
  val examples = List(
    "esmeta help                  # show help message.",
    "esmeta help extract          # show help message of `extract` command.",
  )
  override val targetName = "[<command>]"
  override val needTarget = false
}

// -----------------------------------------------------------------------------
// Mechanized Specification Extraction
// -----------------------------------------------------------------------------
/** `extract` command */
case object CmdExtract extends Command("extract", CmdBase >> Extract) {
  val help = "extracts specification model from ECMA-262 (spec.html)."
  val examples = List(
    "esmeta extract                           # extract current version.",
    "esmeta extract -extract:target=es2025    # extract es2025 version.",
    "esmeta extract -extract:target=868fe7a   # extract 868fe7a hash version.",
  )
}

// -----------------------------------------------------------------------------
// Polyfill Generator
// -----------------------------------------------------------------------------
/** `gen-poly` command */
case object CmdGenPoly extends Command("gen-poly", CmdExtract >> GenPoly) {
  val help = "generates polyfill code."
  val examples = List(
    "esmeta gen-poly                        # generate polyfill code.",
    "esmeta gen-poly -extract:target=es2022 # generate polyfill from es2022.",
  )
}
