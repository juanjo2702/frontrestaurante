import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, UtensilsCrossed, Plus, Search, Edit2, Trash2, 
  ToggleLeft, ToggleRight, X, Save, DollarSign, Loader2, Image
} from 'lucide-react';
import { clsx } from 'clsx';
import api from '../../services/api';
import { toast } from 'sonner';

const AdminMenu = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]); // All available ingredients
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  const [formData, setFormData] = useState({ 
    nombre: '', precio: '', categoria_id: '', 
    descripcion: '', disponible: true, imagen_url: '',
    ingredientes: [] // [{ id, cantidad }]
  });
  const [formLoading, setFormLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const fetchData = async () => {
      try {
          const [prodRes, catRes, ingRes] = await Promise.all([
              api.get('/products'),
              api.get('/categories'),
              api.get('/ingredients')
          ]);
          setProducts(prodRes.data);
          // Filter only menu categories
          setCategories(catRes.data.filter(c => c.tipo === 'menu'));
          setAllIngredients(ingRes.data);
      } catch (error) {
          console.error("Error al cargar menú:", error);
          toast.error("Error al cargar productos");
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, []);

  const filteredItems = products.filter(item => {
    const catName = item.categoria?.nombre || '';
    const matchSearch = item.nombre.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || catName === filterCategory;
    return matchSearch && matchCategory;
  });

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ 
          nombre: item.nombre, 
          precio: item.precio, 
          categoria_id: item.categoria_id, 
          descripcion: item.descripcion || '', 
          disponible: item.disponible === 1 || item.disponible === true, 
          imagen_url: item.imagen_url || '',
          ingredientes: item.ingredientes?.map(i => ({ 
            id: i.id, 
            cantidad: i.pivot?.cantidad_necesaria || 0 
          })) || [] 
      });
      setImageFile(null);
      setImagePreview(item.imagen_url || null);
    } else {
      setEditingItem(null);
      const defaultCat = categories.length > 0 ? categories[0].id : '';
      setFormData({ 
        nombre: '', precio: '', categoria_id: defaultCat, 
        descripcion: '', disponible: true, imagen_url: '',
        ingredientes: []
      });
      setImageFile(null);
      setImagePreview(null);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.nombre || !formData.precio || !formData.categoria_id) {
        toast.error("Complete campos obligatorios");
        return;
    }
    
    setFormLoading(true);
    try {
        let res;
        const hasImage = imageFile !== null;
        
        if (hasImage) {
            const fd = new FormData();
            fd.append('nombre', formData.nombre);
            fd.append('precio', parseFloat(formData.precio));
            fd.append('categoria_id', formData.categoria_id);
            fd.append('descripcion', formData.descripcion || '');
            fd.append('disponible', formData.disponible ? '1' : '0');
            fd.append('imagen', imageFile);
            
            formData.ingredientes.forEach((ing, idx) => {
                fd.append(`ingredientes[${idx}][id]`, ing.id);
                fd.append(`ingredientes[${idx}][cantidad]`, ing.cantidad);
            });
            
            if (editingItem) {
                fd.append('_method', 'PUT');
                res = await api.post(`/products/${editingItem.id}`, fd);
            } else {
                res = await api.post('/products', fd);
            }
        } else {
            const payload = { ...formData, precio: parseFloat(formData.precio) };
            if (editingItem) {
                res = await api.put(`/products/${editingItem.id}`, payload);
            } else {
                res = await api.post('/products', payload);
            }
        }
        
        if (editingItem) {
            setProducts(prev => prev.map(p => p.id === editingItem.id ? res.data : p));
            toast.success("Producto actualizado");
        } else {
            setProducts(prev => [...prev, res.data]);
            toast.success("Producto creado");
        }
        
        const previewToRevoke = imagePreview;
        setShowModal(false);
        setImageFile(null);
        setImagePreview(null);
        if (previewToRevoke && previewToRevoke.startsWith('blob:')) {
            URL.revokeObjectURL(previewToRevoke);
        }
    } catch (error) {
        console.error("Error save:", error);
        toast.error("Error al guardar producto");
    } finally {
        setFormLoading(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (confirm('¿Eliminar este producto permanentemente?')) {
      try {
          await api.delete(`/products/${itemId}`);
          setProducts(prev => prev.filter(p => p.id !== itemId));
          toast.success("Producto eliminado");
      } catch (error) {
          console.error("Error delete:", error);
          toast.error("Error al eliminar");
      }
    }
  };

  const toggleAvailability = async (item) => {
    try {
        const newStatus = !item.disponible;
        const res = await api.put(`/products/${item.id}`, { ...item, disponible: newStatus });
        
        setProducts(prev => prev.map(p => p.id === item.id ? res.data : p));
        toast.success(`Producto ${newStatus ? 'disponible' : 'no disponible'}`);
    } catch (error) {
        console.error("Error toggle:", error);
        toast.error("Error al cambiar disponibilidad");
    }
  };

  return (
    <div className="min-h-screen p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Menú</h1>
            <p className="text-sm text-gray-500">Gestiona los productos del menú</p>
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-medium flex items-center gap-2"
        >
          <Plus size={18} />
          <span>Nuevo Producto</span>
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
          <button
            onClick={() => setFilterCategory('all')}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              filterCategory === 'all' ? "bg-violet-500 text-white" : "text-gray-400"
            )}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.nombre)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1",
                filterCategory === cat.nombre ? "bg-violet-500 text-white" : "text-gray-400"
              )}
            >
              <span>{cat.icono || '🍽️'}</span>
              <span>{cat.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
          <UtensilsCrossed size={20} className="text-gray-400 mb-2" />
          <p className="text-2xl font-bold text-white">{products.length}</p>
          <p className="text-xs text-gray-500">Total Productos</p>
        </div>
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <ToggleRight size={20} className="text-emerald-400 mb-2" />
          <p className="text-2xl font-bold text-white">{products.filter(i => i.disponible).length}</p>
          <p className="text-xs text-gray-500">Disponibles</p>
        </div>
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <ToggleLeft size={20} className="text-red-400 mb-2" />
          <p className="text-2xl font-bold text-white">{products.filter(i => !i.disponible).length}</p>
          <p className="text-xs text-gray-500">No Disponibles</p>
        </div>
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <DollarSign size={20} className="text-amber-400 mb-2" />
          <p className="text-2xl font-bold text-white">Bs. {Math.round(products.reduce((s, i) => s + parseFloat(i.precio), 0) / products.length || 0)}</p>
          <p className="text-xs text-gray-500">Precio Promedio</p>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-amber-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
            {filteredItems.map((item, idx) => {
                 const catIcon = item.categoria?.icono || '🍽️';
                 const catName = item.categoria?.nombre || 'Sin Categoría';
                
                return (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * 0.05 }}
                    className={clsx(
                    "rounded-xl border overflow-hidden",
                    item.disponible 
                        ? "bg-white/[0.02] border-white/5" 
                        : "bg-white/[0.01] border-white/5 opacity-60"
                    )}
                >
                    <div className="relative h-32">
                    <img 
                        src={item.imagen_url || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop"} 
                        alt={item.nombre}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute top-2 left-2">
                        <span className="px-2 py-1 rounded-lg bg-black/40 backdrop-blur-sm text-xs text-white">
                        {catIcon} {catName}
                        </span>
                    </div>
                    <div className="absolute top-2 right-2">
                        <button
                        onClick={() => toggleAvailability(item)}
                        className={clsx(
                            "p-1.5 rounded-lg transition-all",
                            item.disponible 
                            ? "bg-emerald-500/80 text-white" 
                            : "bg-red-500/80 text-white"
                        )}
                        >
                        {item.disponible ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                    </div>
                    </div>
                    
                    <div className="p-3">
                    <h3 className="font-medium text-white truncate">{item.nombre}</h3>
                    <p className="text-lg font-bold text-amber-400">Bs. {item.precio}</p>
                    
                    <div className="flex gap-2 mt-3">
                        <button
                        onClick={() => handleOpenModal(item)}
                        className="flex-1 py-2 rounded-lg bg-white/5 text-gray-400 hover:text-white text-sm flex items-center justify-center gap-1"
                        >
                        <Edit2 size={14} />
                        Editar
                        </button>
                        <button
                        onClick={() => handleDelete(item.id)}
                        className="py-2 px-3 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                        <Trash2 size={14} />
                        </button>
                    </div>
                    </div>
                </motion.div>
                );
            })}
            </AnimatePresence>
            {!loading && filteredItems.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                    No se encontraron productos
                </div>
            )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1a1a1f] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingItem ? 'Editar Producto' : 'Nuevo Producto'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Nombre</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Precio (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) => setFormData(prev => ({ ...prev, precio: e.target.value }))}
                    className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Categoría</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setFormData(prev => ({ ...prev, categoria_id: cat.id }))}
                        className={clsx(
                          "p-3 rounded-xl border flex items-center gap-2 transition-all",
                          formData.categoria_id === cat.id 
                            ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                            : "bg-white/5 border-white/10 text-gray-400"
                        )}
                      >
                        <span>{cat.icono || '🍽️'}</span>
                        <span className="text-sm">{cat.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400">Imagen del Producto</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-amber-500', 'bg-amber-500/10'); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-amber-500', 'bg-amber-500/10'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-amber-500', 'bg-amber-500/10');
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      } else {
                        toast.error("Por favor, selecciona una imagen válida");
                      }
                    }}
                    className="mt-2 w-full h-40 rounded-xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all relative overflow-hidden"
                  >
                    {imagePreview ? (
                      <>
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-white text-sm font-medium">Cambiar imagen</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                          className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-500 z-10"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <Image size={32} className="text-gray-500 mb-2" />
                        <p className="text-sm text-gray-400 text-center px-4">
                          Arrastra una imagen o haz clic para seleccionar
                        </p>
                        <p className="text-xs text-gray-600 mt-1">JPG, PNG, GIF, WEBP • Máx 2MB</p>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      hidden 
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </div>
                </div>
                <div>
                    <label className="text-sm text-gray-400">Descripción (opcional)</label>
                    <textarea 
                        value={formData.descripcion}
                        onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                        className="w-full mt-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50"
                        rows={3}
                    />
                </div>
                </div>
                
                {/* Recipe Section */}
                <div className="border-t border-white/10 pt-4 mt-4">
                  <h3 className="text-lg font-bold text-white mb-3">Receta / Ingredientes</h3>
                  <div className="space-y-3">
                  <div className="flex gap-2 relative">
                        {/* Custom Searchable Combo Box */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder="Buscar ingrediente..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500/50"
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase();
                                    const dropdown = document.getElementById('ingDropdown');
                                    const items = dropdown.querySelectorAll('.ing-option');
                                    let hasMatch = false;
                                    
                                    items.forEach(item => {
                                        const text = item.textContent.toLowerCase();
                                        if (text.includes(val)) {
                                            item.classList.remove('hidden');
                                            hasMatch = true;
                                        } else {
                                            item.classList.add('hidden');
                                        }
                                    });
                                    if(val || hasMatch) dropdown.classList.remove('hidden');
                                }}
                                onFocus={() => document.getElementById('ingDropdown').classList.remove('hidden')}
                                // We need to store the actual ID somewhere. Let's use a hidden input or state. 
                                // To avoid complex refactor without adding new state variables at top, I'll use a hacky data-attribute on this input? 
                                // No, better to add state. But the user asked for simple fix.
                                // Let's try to stick to the DOM manipulation pattern currently used in the 'onClick' handler, but we need to store the ID.
                                id="ingSearchInput"
                            />
                            <input type="hidden" id="ingSelectedId" />
                            
                            <div 
                                id="ingDropdown" 
                                className="hidden absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-[#1a1a1f] border border-white/10 rounded-xl z-50 shadow-xl"
                            >
                                {allIngredients.map(ing => (
                                    <div 
                                        key={ing.id}
                                        className="ing-option p-2 hover:bg-white/10 cursor-pointer flex items-center gap-2 text-sm text-gray-300"
                                        onClick={() => {
                                            document.getElementById('ingSearchInput').value = `${ing.nombre}`;
                                            document.getElementById('ingSelectedId').value = ing.id;
                                            document.getElementById('ingBaseUnit').value = ing.unidad_medida;
                                            
                                            // Reset unit selector options based on base unit
                                            const unitSelect = document.getElementById('ingUnitSelect');
                                            unitSelect.innerHTML = '';
                                            
                                            // Simplified Unit Options
                                            let options = [];
                                            const base = ing.unidad_medida.toLowerCase();
                                            
                                            if (base.includes('kg') || base === 'g') options = ['kg', 'g', 'gramos'];
                                            else if (base === 'l' || base === 'lt' || base === 'ml') options = ['lt', 'ml', 'cc'];
                                            else options = [base]; // Default for 'un', 'paquete', etc.

                                            options.forEach(opt => {
                                                const el = document.createElement('option');
                                                el.value = opt;
                                                el.text = opt;
                                                // Default to base or reasonable match
                                                if(opt === base) el.selected = true;
                                                unitSelect.appendChild(el);
                                            });

                                            document.getElementById('ingDropdown').classList.add('hidden');
                                        }}
                                    >
                                        <span>{ing.emoji || ing.icono || '📦'}</span>
                                        <span>{ing.nombre}</span>
                                        <span className="text-xs text-gray-500 ml-auto">{ing.stock_actual} {ing.unidad_medida}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <input 
                            id="ingQty"
                            type="number" 
                            step="0.001" 
                            placeholder="Cant." 
                            className="w-20 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500/50"
                        />
                         {/* Hidden input to store base unit for conversion logic if needed */}
                         <input type="hidden" id="ingBaseUnit" />
                        
                        <select
                            id="ingUnitSelect"
                             className="w-20 bg-[#1a1a1f] border border-white/10 rounded-xl px-2 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
                        >
                            <option value="unit" className="bg-[#1a1a1f] text-white">un.</option>
                        </select>

                        <button 
                            onClick={(e) => {
                                e.preventDefault();
                                const idInput = document.getElementById('ingSelectedId');
                                const searchInput = document.getElementById('ingSearchInput');
                                const qtyInput = document.getElementById('ingQty');
                                const unitSelect = document.getElementById('ingUnitSelect');
                                const baseUnitInput = document.getElementById('ingBaseUnit'); // We need this to know what the backend expects
                                
                                const ingId = parseInt(idInput.value);
                                let qty = parseFloat(qtyInput.value);
                                const selectedUnit = unitSelect.value;
                                const baseUnit = baseUnitInput.value || selectedUnit;

                                if (!ingId || !qty || qty <= 0) return toast.error("Selecciona ingrediente y cantidad");
                                
                                // Validation: Check if units are compatible? 
                                // Ideally yes, but let's just do conversion if we know them.
                                
                                // CONVERSION LOGIC (Frontend -> Backend Base Unit)
                                // We want to store everything in the BASE UNIT of the inventory item.
                                // If inventory is 'kg', and user selected 'g', we divide by 1000.
                                let conversionFactor = 1;
                                
                                if ((baseUnit === 'kg' || baseUnit === 'kilogramo') && (selectedUnit === 'g' || selectedUnit === 'gramos')) {
                                    conversionFactor = 0.001;
                                } else if ((baseUnit === 'l' || baseUnit === 'lt' || baseUnit === 'litro') && (selectedUnit === 'ml' || selectedUnit === 'cc')) {
                                    conversionFactor = 0.001;
                                }

                                const finalQty = qty * conversionFactor;

                                if (formData.ingredientes.some(i => i.id === ingId)) {
                                    return toast.error("Ingrediente ya agregado");
                                }

                                setFormData(prev => ({
                                    ...prev,
                                    ingredientes: [...prev.ingredientes, { id: ingId, cantidad: finalQty }]
                                }));
                                
                                idInput.value = "";
                                searchInput.value = "";
                                qtyInput.value = "";
                            }}
                            className="bg-amber-500 text-white p-2 rounded-xl hover:bg-amber-600 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>  

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                         {formData.ingredientes.map((item) => {
                            const ingDetails = allIngredients.find(i => i.id === item.id);
                            if (!ingDetails) return null;
                            return (
                                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2 text-sm text-white">
                                        <span>{ingDetails.emoji || ingDetails.icono || '📦'}</span>
                                        <span>{ingDetails.nombre}</span>
                                        <span className="text-amber-400 font-bold ml-2">
                                            {item.cantidad} {ingDetails.unidad_medida}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => setFormData(prev => ({ ...prev, ingredientes: prev.ingredientes.filter(i => i.id !== item.id) }))}
                                        className="text-red-400 p-1 hover:bg-white/10 rounded"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )
                        })}
                        {formData.ingredientes.length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-2">Sin ingredientes (no descontará stock)</p>
                        )}
                    </div>
                  </div>
                </div>

              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={formLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {formLoading ? <Loader2 className="animate-spin" /> : <Save size={16} />}
                  Guardar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminMenu;
