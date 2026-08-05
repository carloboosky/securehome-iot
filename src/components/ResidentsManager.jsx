import { useEffect, useState } from "react";

function ResidentsManager({ requestId }) {
  const storageKey = `securehome-residents-${requestId}`;
  const [residents, setResidents] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(residents));
  }, [residents, storageKey]);

  function addResident(event) {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) {
      setMessage("Escribe un nombre válido.");
      return;
    }
    if (residents.some(resident => resident.toLocaleLowerCase("es") === cleanName.toLocaleLowerCase("es"))) {
      setMessage("Ese residente ya está registrado.");
      return;
    }
    setResidents(previous => [...previous, cleanName]);
    setName("");
    setMessage(`${cleanName} fue agregado correctamente.`);
  }

  return <article className="residents-card">
    <div className="residents-heading">
      <span className="control-icon">👥</span>
      <div><h3>Gestión de residentes</h3><p>Registra quién tiene acceso o vive actualmente en el hogar.</p></div>
      <span className="device-badge">{residents.length} {residents.length === 1 ? "persona" : "personas"}</span>
    </div>
    <form className="resident-form" onSubmit={addResident}>
      <input maxLength={80} placeholder="Nombre del residente" value={name} onChange={event => { setName(event.target.value); setMessage(""); }} aria-label="Nombre del residente"/>
      <button type="submit">＋ Agregar</button>
    </form>
    {message && <p className="resident-message" role="status">{message}</p>}
    {residents.length ? <ul className="resident-list">
      {residents.map(resident => <li key={resident}><span>👤</span><b>{resident}</b><button type="button" onClick={() => setResidents(previous => previous.filter(item => item !== resident))} aria-label={`Eliminar a ${resident}`}>Eliminar</button></li>)}
    </ul> : <p className="empty-residents">Todavía no hay residentes registrados.</p>}
  </article>;
}

export default ResidentsManager;
