import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const FIELD =
  'w-full rounded-md border border-accent/30 bg-white/6 px-4 py-3 text-base text-white outline-none transition-colors duration-200 focus:border-primary';

const CreatePlanetModal = ({ show, onClose, onPlanetCreated }) => {
  const [formData, setFormData] = useState({
    name: '',
    planet_type: 'Exoplanet',
    discovery_year: '',
    description: '',
    atmosphere_summary: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);

  if (!show) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrorInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorInfo(null);
    setSuccessInfo(null);

    const payload = {
      name: formData.name.trim(),
      planet_type: formData.planet_type.trim(),
      description: formData.description.trim(),
      discovery_year: formData.discovery_year ? parseInt(formData.discovery_year, 10) : null,
      atmosphere_summary: formData.atmosphere_summary.trim() || null
    };

    try {
      const response = await axios.post(`${API_BASE_URL}/api/v1/planets`, payload);
      const data = response.data;
      setSuccessInfo(data);
      setFormData({
        name: '',
        planet_type: 'Exoplanet',
        discovery_year: '',
        description: '',
        atmosphere_summary: ''
      });

      if (onPlanetCreated) {
        onPlanetCreated(data.data.planet);
      }

      setTimeout(() => {
        onClose();
        setSuccessInfo(null);
      }, 1800);
    } catch (err) {
      console.error('Create planet error:', err);
      const res = err.response?.data;
      if (res) {
        setErrorInfo({
          message: res.message || 'Failed to create planet',
          error_code: res.error_code || 'ERROR',
          details: res.details
        });
      } else {
        setErrorInfo({
          message: 'Unable to connect to server. Check backend API status.',
          error_code: 'NETWORK_ERROR'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[2000] flex animate-fade-in items-center justify-center bg-black/85 backdrop-blur-[8px]" onClick={onClose}>
        <div className="relative w-[90%] max-w-[600px] animate-scale-in rounded-xl border border-accent/40 bg-panel/95 p-8 text-white shadow-[0_0_30px_rgba(234,94,19,0.25)]" onClick={(e) => e.stopPropagation()}>
          <div className="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="m-0 text-[1.75rem] font-bold text-primary"> Add Planet Record</h3>
            <button className="cursor-pointer border-none bg-none text-2xl text-[#aaa] transition-colors duration-200 hover:text-white" onClick={onClose}>&times;</button>
          </div>

          {errorInfo && (
            <div className="mb-4 rounded-md border border-[rgba(255,80,80,0.4)] bg-[rgba(255,80,80,0.15)] px-4 py-3 text-[0.95rem] text-[#ff6b6b]">
              <strong>[{errorInfo.error_code}]</strong> {errorInfo.message}
              {errorInfo.details && (
                <ul className="mt-[0.4rem] ml-4 list-disc p-0">
                  {Object.entries(errorInfo.details).map(([k, v]) => (
                    <li key={k}>{k}: {v}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {successInfo && (
            <div className="mb-4 rounded-md border border-[rgba(80,225,120,0.4)] bg-[rgba(80,225,120,0.15)] px-4 py-3 text-[0.95rem] text-[#50e178]">
              ✅ {successInfo.message}
              <br />
              <small>Mode: {successInfo.data?.sync_metadata?.consistency_mode}</small>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-5">
                <label className="mb-[0.4rem] block text-[0.95rem] text-white/85">Planet Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Kepler-186f"
                  className={FIELD}
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="mb-5">
                <label className="mb-[0.4rem] block text-[0.95rem] text-white/85">Planet Type *</label>
                <select
                  name="planet_type"
                  className={`${FIELD} [&_option]:bg-panel [&_option]:text-white`}
                  value={formData.planet_type}
                  onChange={handleChange}
                >
                  <option value="Exoplanet">Exoplanet</option>
                  <option value="Terrestrial">Terrestrial</option>
                  <option value="Gas Giant">Gas Giant</option>
                  <option value="Ice Giant">Ice Giant</option>
                  <option value="Dwarf Planet">Dwarf Planet</option>
                </select>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-[0.4rem] block text-[0.95rem] text-white/85">Discovery Year</label>
              <input
                type="number"
                name="discovery_year"
                placeholder="e.g. 2014"
                className={FIELD}
                value={formData.discovery_year}
                onChange={handleChange}
              />
            </div>

            <div className="mb-5">
              <label className="mb-[0.4rem] block text-[0.95rem] text-white/85">Description *</label>
              <textarea
                name="description"
                required
                rows={3}
                placeholder="Enter planetary description and full-text search notes..."
                className={FIELD}
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="mb-5">
              <label className="mb-[0.4rem] block text-[0.95rem] text-white/85">Atmosphere Summary</label>
              <textarea
                name="atmosphere_summary"
                rows={2}
                placeholder="Atmospheric composition summary (e.g., Nitrogen, CO2, Methane)..."
                className={FIELD}
                value={formData.atmosphere_summary}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className="mt-4 w-full cursor-pointer rounded-md border-none bg-linear-135 from-[#111111] to-[#100f0e] p-[0.85rem] text-[1.1rem] font-semibold text-white transition-[opacity,transform] duration-200 enabled:hover:-translate-y-0.5 enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={loading}>
              {loading ? 'Submitting...' : ' Submit Planet Record'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreatePlanetModal;
