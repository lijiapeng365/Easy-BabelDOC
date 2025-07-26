import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * 合并 CSS 类名的工具函数
 * 结合 clsx 和 tailwind-merge 的功能
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}