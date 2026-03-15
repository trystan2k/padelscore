import { vi } from 'vitest'

vi.mock('@zos/device', () => ({
  getDeviceInfo: vi.fn(() => ({
    width: 466,
    height: 466,
    screenShape: 'round'
  }))
}))

vi.mock('@zos/sensor', () => {
  const mockTimeInstance = {
    getTime: vi.fn(() => 1710514200000),
    getFullYear: vi.fn(() => 2024),
    getMonth: vi.fn(() => 3),
    getDate: vi.fn(() => 15),
    getHours: vi.fn(() => 14),
    getMinutes: vi.fn(() => 30)
  }
  const Time = vi.fn(() => mockTimeInstance)
  Time.mockTimeInstance = mockTimeInstance
  return { Time }
})
