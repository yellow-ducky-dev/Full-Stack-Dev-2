import React, { useState, useEffect } from 'react';
import { Calendar, Video, Plus, Users, Clock, Loader2, X } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { api } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface Meeting {
  _id: string;
  title: string;
  description: string;
  scheduledAt: string;
  duration: number;
  status: string;
  organizer: { _id: string; name: string; role: string };
  participants: { _id: string; name: string; role: string }[];
  videoRoomId: string;
}

interface OpponentUser {
  _id: string;
  name: string;
  role: string;
  email: string;
}

export const MeetingsPage: React.FC = () => {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState<OpponentUser[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState('30');
  const [participantId, setParticipantId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Join State
  const [quickRoomId, setQuickRoomId] = useState('');

  const fetchMeetings = async () => {
    try {
      const res = await api.get('/meetings');
      setMeetings(res.data);
    } catch (error) {
      toast.error('Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users?limit=100');
      if (res.data && res.data.users) {
        // Filter out current user from potential participants List
        setUsers(res.data.users.filter((u: any) => u._id !== user?.id));
      }
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchUsers();
    }
  }, [isModalOpen]);

  const handleJoinMeeting = (roomId: string) => {
    navigate(`/video/${roomId}`);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !scheduledAt || !participantId) {
      toast.error('Please enter Title, Date/Time, and select a Participant');
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/meetings', {
        title,
        description,
        participants: [participantId],
        scheduledAt,
        duration: Number(duration),
        notes
      });
      toast.success('Meeting scheduled successfully!');
      setIsModalOpen(false);
      // Reset fields
      setTitle('');
      setDescription('');
      setScheduledAt('');
      setDuration('30');
      setParticipantId('');
      setNotes('');
      // Refetch meetings
      fetchMeetings();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to schedule meeting');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
          <p className="text-gray-600">Schedule and manage your video calls</p>
        </div>
        
        <Button onClick={() => setIsModalOpen(true)} leftIcon={<Plus size={18} />}>
          Schedule Meeting
        </Button>
      </div>

      {/* Quick Direct Join and Info area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-primary-200 bg-primary-50/40">
          <CardHeader>
            <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
              <Video className="text-primary-600" size={18} />
              Instant Video Test
            </h2>
          </CardHeader>
          <CardBody className="pt-0 space-y-3">
            <p className="text-xs text-primary-800 leading-relaxed">
              Enter any room name below to test peer-to-peer WebRTC video/audio streaming instantly. Connect a second device or open another browser tab to the same room.
            </p>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. test-room" 
                value={quickRoomId}
                onChange={(e) => setQuickRoomId(e.target.value)}
                className="flex-1 px-3 py-1.5 text-sm border border-primary-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition-all bg-white"
              />
              <Button 
                size="sm" 
                onClick={() => {
                  if (!quickRoomId.trim()) {
                    toast.error('Please enter a room name');
                    return;
                  }
                  navigate(`/video/${quickRoomId.trim()}`);
                }}
              >
                Join
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="md:col-span-2 border-gray-200">
          <CardHeader>
            <h2 className="text-base font-medium text-gray-900">Meeting Overview</h2>
          </CardHeader>
          <CardBody className="pt-0 text-sm text-gray-600 leading-relaxed space-y-2">
            <p>
              The scheduling system uses real conflict-detection in model handlers. 
              We check the participant timelines and reject double-bookings automatically to protect your productivity.
            </p>
            <p className="text-xs text-gray-500">
              Tip: Scheduled meetings in progress will reveal a <span className="font-semibold text-primary-700">Join Call</span> button below, redirecting both participants into a secure room.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <h2 className="text-lg font-medium text-gray-900">Upcoming Meetings</h2>
        </CardHeader>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : meetings.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <Calendar className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <p>No upcoming meetings scheduled.</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsModalOpen(true)}>
                Schedule your first meeting
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div key={meeting._id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg hover:border-primary-100 hover:bg-primary-50/50 transition-colors duration-200">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary-100 rounded-full text-primary-700">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{meeting.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={14} /> {new Date(meeting.scheduledAt).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={14} /> {meeting.participants.length} Attendees
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {meeting.status === 'scheduled' || meeting.status === 'accepted' || meeting.status === 'pending' ? (
                      <Button size="sm" onClick={() => handleJoinMeeting(meeting.videoRoomId)} leftIcon={<Video size={16} />}>
                        Join Call
                      </Button>
                    ) : (
                      <Badge variant="secondary">{meeting.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Schedule Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                <h3 className="text-lg font-semibold text-gray-900">Schedule a Meeting</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleScheduleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Meeting Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                    placeholder="e.g. Project Pitch"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                    placeholder="Agenda description"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Select Participant *</label>
                  <select
                    required
                    value={participantId}
                    onChange={(e) => setParticipantId(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm bg-white"
                  >
                    <option value="">-- Select Contact --</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role}) - {u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration (mins)</label>
                    <input
                      type="number"
                      min="5"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Agenda Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                    placeholder="Preparatory files, links or details"
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-150">
                  <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Scheduling...' : 'Schedule'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
