import {
  Sun, Moon, Palette, Bot, Key, RefreshCw, Save, Upload, ClipboardList, ClipboardCopy,
  Trophy, Star, X, Check, CircleCheck, ThumbsUp, Scale, Hammer, TriangleAlert,
  ArrowLeftRight, Search, Eye, EyeOff, ChartColumn, MessageCircle, Radio, Plus, ClipboardCheck,
  Home, Users, LayoutList, Zap, Menu, SlidersHorizontal, ArrowDownToLine, Settings,
  ChevronUp, ChevronDown,
} from 'lucide-react'

const MAP = {
  sun: Sun, moon: Moon, palette: Palette, bot: Bot, key: Key, refresh: RefreshCw,
  save: Save, upload: Upload, clipboard: ClipboardList, 'clipboard-copy': ClipboardCopy,
  'clipboard-check': ClipboardCheck, trophy: Trophy, star: Star, x: X, check: Check,
  'check-circle': CircleCheck, 'thumbs-up': ThumbsUp, scale: Scale, hammer: Hammer,
  warning: TriangleAlert, swap: ArrowLeftRight, search: Search, eye: Eye, 'eye-off': EyeOff,
  chart: ChartColumn, message: MessageCircle, radio: Radio, plus: Plus,
  home: Home, roster: Users, board: LayoutList, zap: Zap,
  menu: Menu, filter: SlidersHorizontal, 'arrow-down': ArrowDownToLine, settings: Settings,
  'chevron-up': ChevronUp, 'chevron-down': ChevronDown,
}

export default function Icon({ name, size = 18, label, className, strokeWidth = 2 }) {
  const C = MAP[name] || Star
  return (
    <C
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
