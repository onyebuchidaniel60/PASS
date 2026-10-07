"use client";

/**
 * Barrel for the §14 reference language.
 *
 * Every screen rebuild imports from here rather than reaching into the
 * individual modules, so a rename is one edit and the dependency graph of a
 * screen still says "this screen uses the reference language" in one line.
 */

export {
  GradientWash,
  NoiseOverlay,
  Surface,
  Watermark,
  type SurfaceProps,
  type WashStrength,
} from "./surface";

export {
  DisplayHeadline,
  DotEyebrow,
  HERO_LINES,
  NumberedEyebrow,
  type DisplayHeadlineProps,
  type HeadlineWord,
  type NumberedEyebrowProps,
} from "./headline";

export {
  ChipBar,
  ChipButton,
  CornerBracketFrame,
  LiveDot,
  StatusBadge,
  type ChipButtonProps,
  type CornerBracketFrameProps,
  type LiveDotProps,
  type StatusBadgeProps,
  type StatusTone,
} from "./markers";

export {
  DataCard,
  MetricCard,
  MetricCardRow,
  Sparkline,
  type CardMetric,
  type DataCardProps,
  type MetricCardProps,
  type SparklineProps,
} from "./card";

export {
  DenseHead,
  DenseRow,
  StepGrid,
  TickerBar,
  type DenseRowProps,
  type StepSpec,
  type TickerBarProps,
  type TickerEntry,
} from "./blocks";

export { Logo, LogoMark, type LogoProps } from "./logo";
