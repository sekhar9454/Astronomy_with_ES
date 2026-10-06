import React, { useState } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

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
      <style>
        {`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            animation: fadeIn 0.3s ease;
          }
          .modal-card {
            background: rgba(20, 24, 38, 0.95);
            border: 1px solid rgba(234, 94, 19, 0.4);
            border-radius: 12px;
            box-shadow: 0 0 30px rgba(234, 94, 19, 0.25);
            width: 90%;
            max-width: 600px;
            padding: 2rem;
            color: #fff;
            position: relative;
            animation: scaleUp 0.3s ease;
          }
          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            padding-bottom: 1rem;
            margin-bottom: 1.5rem;
          }
          .modal-title {
            color: var(--primary-color, #000000);
            margin: 0;
            font-size: 1.75rem;
            font-weight: 700;
          }
          .modal-close-btn {
            background: none;
            border: none;
            color: #aaa;
            font-size: 1.5rem;
            cursor: pointer;
            transition: color 0.2s;
          }
          .modal-close-btn:hover {
            color: #fff;
          }
          .form-group {
            margin-bottom: 1.25rem;
          }
          .form-label {
            display: block;
            margin-bottom: 0.4rem;
            font-size: 0.95rem;
            color: rgba(255, 255, 255, 0.85);
          }
          .form-input, .form-select, .form-textarea {
            width: 100%;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(234, 94, 19, 0.3);
            border-radius: 6px;
            color: #fff;
            padding: 0.75rem 1rem;
            font-size: 1rem;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.2s;
          }
          .form-input:focus, .form-select:focus, .form-textarea:focus {
            border-color: var(--primary-color, #ea5e13);
          }
          .form-select option {
            background: #141826;
            color: #fff;
          }
          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }
          .submit-btn {
            width: 100%;
            background: linear-gradient(135deg, #111111 0%, #100f0e 100%);
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 1.1rem;
            font-weight: 600;
            padding: 0.85rem;
            cursor: pointer;
            transition: opacity 0.2s, transform 0.2s;
            margin-top: 1rem;
          }
          .submit-btn:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-2px);
          }
          .submit-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .alert-box {
            padding: 0.75rem 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.95rem;
          }
          .alert-error {
            background: rgba(255, 80, 80, 0.15);
            border: 1px solid rgba(255, 80, 80, 0.4);
            color: #ff6b6b;
          }
          .alert-success {
            background: rgba(80, 225, 120, 0.15);
            border: 1px solid rgba(80, 225, 120, 0.4);
            color: #50e178;
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleUp { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        `}
      </style>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title"> Add Planet Record</h3>
            <button className="modal-close-btn" onClick={onClose}>&times;</button>
          </div>

          {errorInfo && (
            <div className="alert-box alert-error">
              <strong>[{errorInfo.error_code}]</strong> {errorInfo.message}
              {errorInfo.details && (
                <ul style={{ margin: '0.4rem 0 0 1rem', padding: 0 }}>
                  {Object.entries(errorInfo.details).map(([k, v]) => (
                    <li key={k}>{k}: {v}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {successInfo && (
            <div className="alert-box alert-success">
              ✅ {successInfo.message}
              <br />
              <small>Mode: {successInfo.data?.sync_metadata?.consistency_mode}</small>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Planet Name *</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Kepler-186f"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Planet Type *</label>
                <select
                  name="planet_type"
                  className="form-select"
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

            <div className="form-group">
              <label className="form-label">Discovery Year</label>
              <input
                type="number"
                name="discovery_year"
                placeholder="e.g. 2014"
                className="form-input"
                value={formData.discovery_year}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                name="description"
                required
                rows={3}
                placeholder="Enter planetary description and full-text search notes..."
                className="form-textarea"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Atmosphere Summary</label>
              <textarea
                name="atmosphere_summary"
                rows={2}
                placeholder="Atmospheric composition summary (e.g., Nitrogen, CO2, Methane)..."
                className="form-textarea"
                value={formData.atmosphere_summary}
                onChange={handleChange}
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Submitting...' : ' Submit Planet Record'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default CreatePlanetModal;
