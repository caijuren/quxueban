import path from 'path'
import fs from 'fs/promises'
import { env } from '../config/env'
import { supabase } from '../config/supabase'

const LOCAL_COVER_DIR = path.resolve(process.cwd(), 'uploads/book-covers')

export async function saveCoverLocally(buffer: Buffer, fileExt = 'jpg'): Promise<string> {
  await fs.mkdir(LOCAL_COVER_DIR, { recursive: true })
  const safeExt = fileExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`
  const filePath = path.join(LOCAL_COVER_DIR, fileName)
  await fs.writeFile(filePath, buffer)
  return `${env.API_PREFIX}/uploads/book-covers/${fileName}`
}

export async function storeCoverBuffer(buffer: Buffer, fileExt: string, contentType?: string): Promise<string> {
  if (supabase && env.SUPABASE_STORAGE_BUCKET) {
    const fileName = `covers/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
    const { error } = await supabase.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(fileName, buffer, {
        cacheControl: '3600',
        upsert: false,
        ...(contentType ? { contentType } : {}),
      })

    if (!error) {
      const { data: urlData } = supabase.storage
        .from(env.SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(fileName)
      if (urlData.publicUrl) return urlData.publicUrl
    }

    console.error('[Cover Storage] Supabase upload failed, falling back to local:', error)
  }

  return saveCoverLocally(buffer, fileExt)
}

export function cleanIsbn(isbn: string): string {
  return String(isbn || '').replace(/[\s-]/g, '')
}

export function normalizeBookName(name: string): string {
  return String(name || '')
    .trim()
    .replace(/[《》<>]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function normalizeText(value: string): string {
  return String(value || '')
    .trim()
    .replace(/[《》<>]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

export function normalizeYear(value: unknown): string {
  const match = String(value || '').match(/\d{4}/)
  return match ? match[0] : ''
}

export function firstText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ')
  }
  return value ? String(value) : ''
}

export function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = parseInt(String(value || ''), 10)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed
  }
  return 0
}

export function pickRowValue(row: any, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return ''
}

export function parseBookType(type: string): string {
  const typeMap: Record<string, string> = {
    '绘本': 'picture_book',
    'picture_book': 'picture_book',
    '漫画': 'comic',
    'comic': 'comic',
    '小说': 'novel',
    'novel': 'novel',
    '科普': 'science',
    'science': 'science',
    '教材': 'textbook',
    'textbook': 'textbook',
    '其他': 'other',
    'other': 'other',
  }
  return typeMap[type] || 'other'
}

export function getBookTypeLabel(type: string): string {
  const labelMap: Record<string, string> = {
    'picture_book': '绘本',
    'comic': '漫画',
    'novel': '小说',
    'science': '科普',
    'textbook': '教材',
    'other': '其他',
  }
  return labelMap[type] || '其他'
}
