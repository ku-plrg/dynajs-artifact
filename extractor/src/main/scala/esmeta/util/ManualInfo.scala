package esmeta.util

import esmeta.MANUALS_DIR
import esmeta.cfg.CFG
import esmeta.es.builtin.*
import esmeta.spec.Spec
import esmeta.ty.TyModel
import esmeta.util.BaseUtils.*
import esmeta.util.SystemUtils.*
import java.io.File

/** manual information helpers */
object ManualInfo {

  /** manual algorithm files */
  lazy val algoFiles: List[String] = getFileNames(algoFilter)

  /** manual IR function files */
  lazy val funcFiles: List[String] = getFileNames(irFilter)

  /** manual compilation rule */
  lazy val compileRule: CompileRule =
    readJson[CompileRule](s"$MANUALS_DIR/rule.json")
  type CompileRule = Map[String, Map[String, String]]

  lazy val polyfillRule: Map[String, String] =
    val file = File(s"$MANUALS_DIR/polyfill-rule.json")
    if file.exists then readJson[Map[String, String]](file.getPath)
    else Map.empty

  /** bugfix patch map */
  lazy val bugfixPatchMap: Map[String, String] = (for {
    file <- getFiles(patchFilter)
    name = file.getName
    pattern = "(.*).patch".r
    hash <- name match
      case pattern(hash) => Some(hash)
      case _             => None
  } yield hash -> file.toString).toMap

  /** type model */
  lazy val tyModel: TyModel =
    TyModel.fromFile(s"$MANUALS_DIR/types")

  /** intrinsics */
  lazy val intrinsics: Intrinsics =
    Intrinsics.fromFile(s"$MANUALS_DIR/intrinsics")

  /** find all files in the manual directory with a filter */
  private def getFiles(filter: String => Boolean): List[File] = (for {
    file <- walkTree(MANUALS_DIR)
    if filter(file.getName)
  } yield file).toList

  /** find all file names in the manual directory with a filter */
  private def getFileNames(filter: String => Boolean): List[String] =
    getFiles(filter).map(_.toString)
}
