/**
 * API Route Tests: Sync Devices
 * GET/POST /api/sync/devices (device registration and list)
 * @jest-environment node
 */

import { createMockNextRequest, parseJsonResponse } from './helpers'

describe('POST /api/sync/devices', () => {
  it('returns 400 when userId or device missing', async () => {
    const { POST } = await import('@/app/api/sync/devices/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/devices',
      method: 'POST',
      body: { userId: 'u1' },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('userId')
  })

  it('returns 200 and registers a new device', async () => {
    const { POST } = await import('@/app/api/sync/devices/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/devices',
      method: 'POST',
      body: {
        userId: 'user-devices-1',
        device: {
          id: 'dev-1',
          name: 'Chrome',
          type: 'desktop',
          platform: 'Win32',
          lastSeen: new Date(),
          isActive: true,
        },
      },
    })
    const response = await POST(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).success).toBe(true)
    expect((data as Record<string, unknown>).totalDevices).toBe(1)
    expect((data as Record<string, unknown>).device).toBeDefined()
  })

  it('returns 200 and updates existing device', async () => {
    const { POST, GET } = await import('@/app/api/sync/devices/route')
    const userId = 'user-update-device'
    const device = {
      id: 'dev-update',
      name: 'Firefox',
      type: 'desktop',
      platform: 'Linux',
      lastSeen: new Date(),
      isActive: true,
    }
    await POST(
      createMockNextRequest({
        url: 'http://localhost:3000/api/sync/devices',
        method: 'POST',
        body: { userId, device },
      }) as any
    )
    const updateResponse = await POST(
      createMockNextRequest({
        url: 'http://localhost:3000/api/sync/devices',
        method: 'POST',
        body: { userId, device: { ...device, name: 'Firefox Updated' } },
      }) as any
    )
    const updateData = await parseJsonResponse(updateResponse)
    expect(updateResponse.status).toBe(200)
    expect((updateData as Record<string, unknown>).totalDevices).toBe(1)

    const getResponse = await GET(
      createMockNextRequest({
        url: `http://localhost:3000/api/sync/devices?userId=${userId}`,
        method: 'GET',
      }) as any
    )
    const getData = await parseJsonResponse(getResponse)
    expect((getData as Record<string, unknown>).devices).toHaveLength(1)
    expect((getData as Record<string, unknown>).devices?.[0]?.name).toBe('Firefox Updated')
  })
})

describe('GET /api/sync/devices', () => {
  it('returns 400 when userId missing', async () => {
    const { GET } = await import('@/app/api/sync/devices/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/devices',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(400)
    expect((data as Record<string, unknown>).error).toContain('userId')
  })

  it('returns 200 with empty devices when user has none', async () => {
    const { GET } = await import('@/app/api/sync/devices/route')
    const request = createMockNextRequest({
      url: 'http://localhost:3000/api/sync/devices?userId=user-no-devices',
      method: 'GET',
    })
    const response = await GET(request as any)
    const data = await parseJsonResponse(response)

    expect(response.status).toBe(200)
    expect((data as Record<string, unknown>).devices).toEqual([])
    expect((data as Record<string, unknown>).totalDevices).toBe(0)
  })
})
