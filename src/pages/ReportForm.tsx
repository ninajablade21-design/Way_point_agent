import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, X, MapPin, Loader2, ShieldCheck, Bot } from 'lucide-react';
import { useReports } from '@/hooks/useReports';
import { useToast } from '@/components/ui/Toast';
import { repo } from '@/services/storage';
import { classifyHazard } from '@/services/classifier';
import { CATEGORIES, SEVERITIES, CATEGORY_META } from '@/lib/constants';
import { fileToCompressedDataUrl } from '@/lib/image';
import type { HazardCategory, Severity } from '@/types';
import { HazardMap } from '@/components/HazardMap';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ReportForm() {
  const { reports, refresh } = useReports();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<HazardCategory>('Pothole');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [locationName, setLocationName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [aiClassified, setAiClassified] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast('Please upload a JPG, PNG, or WebP image', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast('Image must be under 5 MB', 'error');
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImagePreview(dataUrl);
      setImageDataUrl(dataUrl);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const setPoint = (latitude: number, longitude: number) => {
    setLat(Number(latitude.toFixed(6)));
    setLon(Number(longitude.toFixed(6)));
  };

  const runAIClassify = () => {
    if (!description.trim() && !title.trim()) {
      toast('Add a title or description first', 'warning');
      return;
    }
    const result = classifyHazard(`${title} ${description}`);
    setCategory(result.category);
    setSeverity(result.severity);
    setAiClassified(true);
    toast(
      `Classified as ${result.category} — ${result.severity} (${Math.round(result.confidence * 100)}% confidence)`,
      result.needsClarification ? 'warning' : 'success'
    );
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast('Geolocation not supported', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPoint(pos.coords.latitude, pos.coords.longitude);
        if (!locationName) setLocationName('My current location');
        toast('Location captured', 'success');
      },
      () => toast('Could not get your location. Check your browser permissions.', 'error')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast('A title is required', 'error');
      return;
    }
    if (!locationName.trim()) {
      toast('A location name is required', 'error');
      return;
    }
    if ((lat === null) !== (lon === null)) {
      toast('Enter both latitude and longitude, or leave both empty', 'error');
      return;
    }
    if (lat !== null && (lat < -90 || lat > 90)) {
      toast('Latitude must be between -90 and 90', 'error');
      return;
    }
    if (lon !== null && (lon < -180 || lon > 180)) {
      toast('Longitude must be between -180 and 180', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const report = await repo.createReport({
        user_id: null,
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        location_name: locationName.trim(),
        latitude: lat,
        longitude: lon,
        image_url: imageDataUrl,
        classification_source: aiClassified ? 'rule-based-agent' : 'user',
        classification_confidence: aiClassified ? 0.8 : 1.0,
      });
      await refresh();
      toast('Report submitted successfully', 'success');
      navigate(`/report/${report.id}`);
    } catch (err) {
      toast('Failed to submit report: ' + (err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report a Hazard</h1>
        <p className="text-sm text-muted mt-1">Help make roads safer for everyone.</p>
      </div>

      <div className="card p-3.5 flex items-start gap-3 border-l-4" style={{ borderLeftColor: 'rgb(var(--info))' }}>
        <ShieldCheck size={18} className="text-[rgb(var(--info))] mt-0.5 shrink-0" />
        <p className="text-xs text-muted leading-relaxed">
          <strong>Privacy notice:</strong> Your location and any photo you upload are stored with this report
          and may be visible to others using this demo. Do not include personal information in descriptions or images.
          Location is only captured with your permission.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-5 space-y-5">
        <div>
          <label className="label">Report title *</label>
          <input
            className="input"
            placeholder="e.g. Large pothole near MG Road junction"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className="input min-h-[100px] resize-y"
            placeholder="Describe the hazard, its size, and the risk it poses..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-faint">{description.length}/1000</span>
            <button type="button" onClick={runAIClassify} className="text-xs accent-text font-medium flex items-center gap-1.5 hover:underline">
              <Bot size={14} /> Suggest category &amp; severity
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as HazardCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Severity</label>
            <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {aiClassified && (
          <div className="text-xs text-muted bg-[rgb(var(--accent-soft))] rounded-lg p-2.5 flex items-center gap-2">
            <Bot size={14} className="accent-text" />
            Suggested from keywords in your description (rule-based). Adjust if needed.
          </div>
        )}

        <div>
          <label className="label">Location name *</label>
          <input
            className="input"
            placeholder="e.g. MG Road, Bengaluru"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Latitude</label>
            <input
              className="input"
              type="number"
              step="any"
              placeholder="12.9756"
              value={lat ?? ''}
              onChange={(e) => setLat(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input
              className="input"
              type="number"
              step="any"
              placeholder="77.6066"
              value={lon ?? ''}
              onChange={(e) => setLon(e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleUseMyLocation} className="btn btn-ghost text-xs">
            <MapPin size={14} /> Use my location
          </button>
          <button type="button" onClick={() => setShowMapPicker((s) => !s)} className="btn btn-ghost text-xs">
            <MapPin size={14} /> {showMapPicker ? 'Hide map picker' : 'Pick on map'}
          </button>
        </div>

        {showMapPicker && (
          <div className="animate-fade-in">
            <p className="text-xs text-faint mb-2">Click on the map to set the report location.</p>
            <HazardMap
              reports={reports}
              height="300px"
              center={lat !== null && lon !== null ? [lat, lon] : [20.5937, 78.9629]}
              zoom={lat !== null && lon !== null ? 15 : 5}
              onMapClick={(la, lo) => setPoint(la, lo)}
              pickedLocation={lat !== null && lon !== null ? [lat, lon] : null}
            />
            <div className="mt-2 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Search a place (e.g. Mumbai)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const query = (e.target as HTMLInputElement).value.trim();
                    if (!query) return;
                    geocode(query).then((coords) => {
                      if (coords) {
                        setPoint(coords.lat, coords.lon);
                        if (!locationName.trim()) setLocationName(query);
                        toast('Location found', 'success');
                      } else {
                        toast('Could not find that place', 'warning');
                      }
                    });
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setLat(null);
                  setLon(null);
                }}
                className="btn btn-ghost text-xs"
              >
                <X size={14} /> Clear
              </button>
            </div>
          </div>
        )}

        {/* Image upload */}
        <div>
          <label className="label">Photo (optional)</label>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleImage}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative rounded-xl overflow-hidden border border-app">
              <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
              <button
                type="button"
                onClick={() => {
                  setImagePreview(null);
                  setImageDataUrl(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                aria-label="Remove photo"
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-app rounded-xl py-8 flex flex-col items-center gap-2 text-muted hover:border-[rgb(var(--accent))] transition-colors"
            >
              <ImagePlus size={28} />
              <span className="text-xs">Click to upload (JPG, PNG, WebP — max 5 MB)</span>
            </button>
          )}
          <p className="text-[11px] text-faint mt-1.5">
            The photo is resized and stored as a reference. It is not analyzed by AI in this version.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn btn-primary flex-1">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : null}
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
          <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}
