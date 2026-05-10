import { GradeSystem } from "@/types/domain";

export const DISCIPLINE_OPTIONS = [
  { label: "抱石", value: "bouldering" },
  { label: "顶绳", value: "top_rope" },
  { label: "先锋", value: "lead" },
  { label: "训练板", value: "training_board" },
  { label: "野攀", value: "outdoor" },
  { label: "其他", value: "other" }
] as const;

export const GRADE_SYSTEM_OPTIONS: { label: string; value: GradeSystem }[] = [
  { label: "V", value: "v_scale" },
  { label: "Font", value: "font" },
  { label: "YDS", value: "yds" },
  { label: "French", value: "french" },
  { label: "颜色", value: "color" },
  { label: "自定义", value: "custom" }
];

export const OUTCOME_OPTIONS = [
  { label: "已完成", value: "sent" },
  { label: "已放弃", value: "not_sent" },
  { label: "尝试中", value: "in_progress" }
] as const;

export const OUTCOME_LABELS = {
  sent: "已完成",
  not_sent: "已放弃",
  in_progress: "尝试中"
} as const;

export const ASCENT_STYLE_OPTIONS = [
  { label: "视攀", value: "onsight" },
  { label: "闪攀", value: "flash" },
  { label: "红点", value: "redpoint" },
  { label: "顶绳完攀", value: "top_rope_clean" },
  { label: "复刷", value: "repeat" },
  { label: "完攀", value: "send" },
  { label: "粉点", value: "pinkpoint" },
  { label: "Headpoint", value: "headpoint" },
  { label: "器械辅助", value: "aid" }
] as const;

export const ATTEMPT_OUTCOME_OPTIONS = [
  { label: "坠落", value: "fall" },
  { label: "Take / 挂绳休息", value: "take" },
  { label: "挂绳练动作", value: "hangdog" },
  { label: "中途放弃", value: "bailed" },
  { label: "蹭地 / 蹭垫 / 蹭墙", value: "dab" },
  { label: "时间不够", value: "time_up" },
  { label: "练动作", value: "worked_moves" }
] as const;

export const BETA_KNOWLEDGE_OPTIONS = [
  { label: "无 beta", value: "none" },
  { label: "看过别人爬", value: "watched_others" },
  { label: "听过 beta", value: "heard_beta" },
  { label: "看过信息", value: "read_beta" },
  { label: "之前试过", value: "previous_attempt" },
  { label: "不确定", value: "unknown" }
] as const;

export const ATTEMPTS_BUCKET_OPTIONS = [
  { label: "1", value: "1" },
  { label: "2-3", value: "2_3" },
  { label: "4-6", value: "4_6" },
  { label: "7-10", value: "7_10" },
  { label: "10+", value: "10_plus" }
] as const;

export const TAG_OPTIONS = [
  "slab",
  "overhang",
  "dyno",
  "balance",
  "crimp",
  "sloper",
  "pinch",
  "compression",
  "heel hook",
  "toe hook",
  "coordination",
  "endurance",
  "power",
  "fear"
];

export const FAILURE_REASON_OPTIONS = [
  "力量不足",
  "技术没找到",
  "恐惧",
  "读线错误",
  "耐力下降",
  "没找到 beta",
  "动作不熟",
  "时间不够",
  "皮肤 / 手指不适"
];

export const STATUS_LABELS = {
  active: "进行中",
  sent: "已完攀",
  paused: "暂停",
  abandoned: "放弃"
} as const;
