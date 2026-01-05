'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Room {
  id: string
  room_type: string
  max_guests: number
  base_price: number
  breakfast_price: number
  is_active: boolean
}

interface BookingForm {
  room_id: string
  check_in: string
  check_out: string
  guests_count: number
  breakfast: boolean
  vehicle: boolean
  customer_name: string
  customer_email: string
  customer_phone: string
}

export default function BookPage() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState<BookingForm>({
    room_id: '',
    check_in: '',
    check_out: '',
    guests_count: 1,
    breakfast: false,
    vehicle: false,
    customer_name: '',
    customer_email: '',
    customer_phone: ''
  })

  // Fetch rooms on mount
  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/bookings/public')
      const data = await response.json()
      if (data.rooms) {
        setRooms(data.rooms)
      }
    } catch (err) {
      setError('Failed to load rooms')
    }
  }

  const calculateTotal = () => {
    const selectedRoom = rooms.find(r => r.id === formData.room_id)
    if (!selectedRoom || !formData.check_in || !formData.check_out) return 0

    const checkIn = new Date(formData.check_in)
    const checkOut = new Date(formData.check_out)
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))
    
    if (nights <= 0) return 0

    let basePrice = selectedRoom.base_price
    let extraGuests = 0
    
    if (selectedRoom.room_type === 'DOUBLE') {
      extraGuests = Math.max(formData.guests_count - 2, 0)
      basePrice = basePrice + (extraGuests * 500)
    }
    
    const breakfastCost = formData.breakfast ? (formData.guests_count * selectedRoom.breakfast_price * nights) : 0
    const vehicleCost = formData.vehicle ? 1000 : 0
    
    return (basePrice * nights) + breakfastCost + vehicleCost
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/bookings/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess('Booking created successfully! We will contact you soon.')
        setFormData({
          room_id: '',
          check_in: '',
          check_out: '',
          guests_count: 1,
          breakfast: false,
          vehicle: false,
          customer_name: '',
          customer_email: '',
          customer_phone: ''
        })
      } else {
        setError(data.error || 'Failed to create booking')
      }
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedRoom = rooms.find(r => r.id === formData.room_id)
  const total = calculateTotal()

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">Book Your Stay</h1>
            <p className="text-blue-100 mt-1">Complete the form below to make a reservation</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {success}
              </div>
            )}

            {/* Room Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Room *
              </label>
              <select
                value={formData.room_id}
                onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Choose a room...</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.room_type} - KES {room.base_price.toLocaleString()}/night
                  </option>
                ))}
              </select>
              {selectedRoom && (
                <p className="mt-1 text-sm text-gray-500">
                  Max guests: {selectedRoom.max_guests} | Breakfast: KES {selectedRoom.breakfast_price.toLocaleString()}/person
                </p>
              )}
            </div>

            {/* Date Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check-in Date *
                </label>
                <input
                  type="date"
                  value={formData.check_in}
                  onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Check-out Date *
                </label>
                <input
                  type="date"
                  value={formData.check_out}
                  onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min={formData.check_in || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>

            {/* Guest Count */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Guests *
              </label>
              <input
                type="number"
                value={formData.guests_count}
                onChange={(e) => setFormData({ ...formData, guests_count: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max={selectedRoom?.max_guests || 1}
                required
              />
            </div>

            {/* Add-ons */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Additional Services
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.breakfast}
                    onChange={(e) => setFormData({ ...formData, breakfast: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Include breakfast</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.vehicle}
                    onChange={(e) => setFormData({ ...formData, vehicle: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Vehicle parking (+KES 1,000)</span>
                </label>
              </div>
            </div>

            {/* Customer Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Your Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Price Summary */}
            {total > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Price Summary</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Base price:</span>
                    <span>KES {selectedRoom?.base_price.toLocaleString()}/night</span>
                  </div>
                  {formData.breakfast && (
                    <div className="flex justify-between">
                      <span>Breakfast:</span>
                      <span>KES {(formData.guests_count * selectedRoom?.breakfast_price!).toLocaleString()}</span>
                    </div>
                  )}
                  {formData.vehicle && (
                    <div className="flex justify-between">
                      <span>Vehicle parking:</span>
                      <span>KES 1,000</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total:</span>
                    <span>KES {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading || !formData.room_id || !formData.check_in || !formData.check_out}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Booking...' : 'Book Now'}
              </button>
              <p className="mt-2 text-sm text-gray-500 text-center">
                No payment required. Booking will be confirmed upon arrival.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
